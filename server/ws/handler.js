// WebSocket 连接与消息处理

import { classifyIntent } from '../modules/router.js';
import { buildSystemPrompt } from '../modules/context.js';
import { chat } from '../modules/deepseekAdapter.js';
import { addToConversation, getRecentMessages, updateContext, getFullContext, setCurrentSong } from '../modules/stateManager.js';
import { searchSongs, getSongUrl, getLikedSongs, getLikedPlaylistName } from '../services/netease.js';
import { recommendSongs, recommendFromLiked, markAsRecommended, recommendedHistory } from '../modules/musicEngine.js';
import { getCurrentWeather } from '../services/weather.js';
import { synthesize } from '../modules/tts.js';
import { recordPlay } from '../store/historyStore.js';
import { updateTagWeight } from '../store/preferenceStore.js';
import { prepare } from '../store/userStore.js';

let connections = new Set();

export function registerWebSocket(fastify) {
  fastify.get('/ws', { websocket: true }, (socket) => {
    connections.add(socket);
    console.log('Client connected, total:', connections.size);

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleMessage(socket, msg);
      } catch (err) {
        socket.send(JSON.stringify({
          type: 'system.error',
          payload: { code: 'PARSE_ERROR', message: err.message },
          timestamp: Date.now()
        }));
      }
    });

    socket.on('close', () => {
      connections.delete(socket);
      console.log('Client disconnected, total:', connections.size);
    });
  });
}

async function handleMessage(socket, msg) {
  const { type, payload } = msg;

  if (type === 'chat.send') {
    await handleChatSend(socket, payload.content);
  } else if (type === 'player.control') {
    handlePlayerControl(socket, payload);
  } else if (type === 'player.played') {
    handleSongPlayed(payload);
  } else {
    socket.send(JSON.stringify({
      type: 'system.error',
      payload: { code: 'UNKNOWN_TYPE', message: `未知消息类型: ${type}` },
      timestamp: Date.now()
    }));
  }
}

async function handleChatSend(socket, content) {
  addToConversation('user', content);
  updateContext({ lastInteraction: Date.now() });

  const intentResult = classifyIntent(content);
  socket.send(JSON.stringify({
    type: 'chat.intent',
    payload: intentResult,
    timestamp: Date.now()
  }));

  if (intentResult.intent === 'music_control') {
    socket.send(JSON.stringify({
      type: 'player.state',
      payload: { action: intentResult.slots.action },
      timestamp: Date.now()
    }));
    return;
  }

  try {
    const context = getFullContext();
    const systemPrompt = buildSystemPrompt(context);

    const aiMessages = getRecentMessages(10).map(m => ({
      role: m.role,
      content: m.content
    }));

    let streamed = false;
    function onStream(data) {
      if (data.type === 'text') {
        streamed = true;
        socket.send(JSON.stringify({
          type: 'chat.stream',
          payload: { content: data.content, done: false },
          timestamp: Date.now()
        }));
      }
    }

    const result = await chat(systemPrompt, aiMessages, onStream);

    // 无文字但有工具调用时，发送提示语
    if (!streamed && result.toolCalls.length > 0) {
      const hint = getToolHint(result.toolCalls[0]?.name);
      socket.send(JSON.stringify({
        type: 'chat.stream',
        payload: { content: hint, done: false },
        timestamp: Date.now()
      }));
      result.content = hint;
    }

    socket.send(JSON.stringify({
      type: 'chat.stream',
      payload: { content: '', done: true },
      timestamp: Date.now()
    }));

    if (result.toolCalls.length > 0) {
      await handleToolCalls(socket, result.toolCalls);
    } else if (intentResult.intent === 'music_request') {
      // AI 没调工具，自动从"我喜欢"推荐
      const { songs } = await recommendFromLiked({}, 6);
      if (songs && songs.length > 0) {
        markAsRecommended(songs.map(s => s.id));
        socket.send(JSON.stringify({
          type: 'music.recommend',
          payload: { songs, reason: '自动从我喜欢歌单推荐' },
          timestamp: Date.now()
        }));
      }
    }

    addToConversation('assistant', result.content);

    try {
      const sessionId = 'session_main';
      prepare('INSERT INTO chat_history (session_id, role, content, intent) VALUES (?, ?, ?, ?)')
        .run(sessionId, 'user', content, intentResult.intent);
      prepare('INSERT INTO chat_history (session_id, role, content, intent) VALUES (?, ?, ?, ?)')
        .run(sessionId, 'assistant', result.content, null);
    } catch { /* db not ready */ }

    if (result.content) {
      const ttsResult = await synthesize(result.content);
      if (ttsResult) {
        socket.send(JSON.stringify({
          type: 'tts.audio',
          payload: { audio: ttsResult.audio, format: ttsResult.format },
          timestamp: Date.now()
        }));
      }
    }
  } catch (err) {
    console.error('Chat error:', err);
    // 把错误也显示给用户
    const errMsg = err.message.includes('API key') ? 'API Key 未配置或无效，请在设置中检查' :
                   err.message.includes('fetch') ? '网络连接失败，请检查网络' :
                   `AI 请求失败: ${err.message}`;
    socket.send(JSON.stringify({
      type: 'chat.stream',
      payload: { content: errMsg, done: false },
      timestamp: Date.now()
    }));
    socket.send(JSON.stringify({
      type: 'chat.stream',
      payload: { content: '', done: true },
      timestamp: Date.now()
    }));
  }
}

async function handleToolCalls(socket, toolCalls) {
  for (const toolCall of toolCalls) {
    try {
      let result;

      switch (toolCall.name) {
        case 'search_songs': {
          const query = (toolCall.input.query || '').toLowerCase();
          const likedSongs = await getLikedSongs();
          const limit = toolCall.input.limit || 10;

          const matched = likedSongs
            .filter(s => s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query));

          // 优先未推荐过的，不够时用已推荐的补位
          const fresh = matched.filter(s => !recommendedHistory.has(s.id));
          const stale = matched.filter(s => recommendedHistory.has(s.id));

          const shuffle = (arr) => {
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
          };

          // 新鲜的不够，不再用重复凑数，只返回剩余的
          if (fresh.length < limit && fresh.length > 0) {
            const songs = shuffle([...fresh]).slice(0, limit);
            markAsRecommended(songs.map(s => s.id));
            let reason = `"${getLikedPlaylistName()}" — "${query}"（仅剩${fresh.length}首未听过）`;
            socket.send(JSON.stringify({
              type: 'music.recommend',
              payload: { songs, reason },
              timestamp: Date.now()
            }));
            result = { songs, found: true };
            break;
          }

          // 全部推荐过了，不再返回重复
          if (fresh.length === 0 && stale.length > 0 && matched.length > 0) {
            socket.send(JSON.stringify({
              type: 'chat.stream',
              payload: { content: `"${getLikedPlaylistName()}"里和"${query}"相关的歌都推过了，换个歌单试试？`, done: false },
              timestamp: Date.now()
            }));
            socket.send(JSON.stringify({
              type: 'chat.stream',
              payload: { content: '', done: true },
              timestamp: Date.now()
            }));
            break;
          }

          const pool = [...shuffle(fresh), ...shuffle(stale)];

          const songs = pool.slice(0, limit);
          const allFresh = stale.length === 0;
          const partialFresh = fresh.length > 0 && fresh.length < limit;
          
          result = { songs, found: songs.length > 0 };
          if (songs.length > 0) {
            markAsRecommended(songs.map(s => s.id));
            let reason = `"${getLikedPlaylistName()}" — "${query}"`;
            if (partialFresh && stale.length > 0) {
              reason += `（该歌手仅剩${fresh.length}首未听过）`;
            } else if (fresh.length === 0 && stale.length > 0) {
              reason += `（该歌手已无未听过歌曲）`;
            }
            socket.send(JSON.stringify({
              type: 'music.recommend',
              payload: { songs, reason },
              timestamp: Date.now()
            }));
          }
          break;
        }

        case 'search_global': {
          const globalResults = await searchSongs(toolCall.input.query, toolCall.input.limit || 10);
          result = { songs: globalResults, found: globalResults.length > 0 };
          if (globalResults.length > 0) {
            socket.send(JSON.stringify({
              type: 'music.recommend',
              payload: { songs: globalResults, reason: `全网搜索 — "${toolCall.input.query}"` },
              timestamp: Date.now()
            }));
          }
          break;
        }

        case 'recommend_songs': {
          let { songs, exhausted } = await recommendFromLiked(toolCall.input, 10);
          let reason = buildRecommendReason(toolCall.input) + ` · "${getLikedPlaylistName()}"`;

          if (exhausted) {
            socket.send(JSON.stringify({
              type: 'chat.stream',
              payload: { content: `"${getLikedPlaylistName()}"里的歌都推过一遍了，换个歌单或者换个口味试试？`, done: false },
              timestamp: Date.now()
            }));
            socket.send(JSON.stringify({
              type: 'chat.stream',
              payload: { content: '', done: true },
              timestamp: Date.now()
            }));
            break;
          }

          // 风格/语言过滤后无结果 → 回退到普通推荐
          if (songs.length === 0 && (toolCall.input.genre || toolCall.input.language)) {
            const fallback = await recommendFromLiked({}, 10);
            if (fallback.length > 0) {
              songs = fallback;
              const hint = toolCall.input.genre || toolCall.input.language;
              reason = `"${getLikedPlaylistName()}"中没有${hint}分类的歌，为你随机推荐`;
            }
          }

          result = { songs };
          markAsRecommended(songs.map(s => s.id));
          if (songs.length > 0) {
            socket.send(JSON.stringify({
              type: 'music.recommend',
              payload: { songs, reason },
              timestamp: Date.now()
            }));
          }

          if (toolCall.input.mood) updateTagWeight('mood', toolCall.input.mood, 0.1);
          if (toolCall.input.scene) updateTagWeight('scene', toolCall.input.scene, 0.1);
          if (toolCall.input.genre) updateTagWeight('genre', toolCall.input.genre, 0.1);
          break;
        }

        case 'get_liked_songs': {
          const songs = await getLikedSongs(30);
          result = { songs: songs.map(s => ({ id: s.id, title: s.title, artist: s.artist })), count: songs.length };
          // 不推送到前端队列，AI 应通过 recommend_songs 推荐具体歌曲
          break;
        }

        case 'get_weather': {
          const weather = await getCurrentWeather(toolCall.input.city);
          updateContext({ weather });
          result = weather;
          break;
        }

        case 'player_control': {
          socket.send(JSON.stringify({
            type: 'player.state',
            payload: { action: toolCall.input.action, value: toolCall.input.value },
            timestamp: Date.now()
          }));
          result = { action: toolCall.input.action };
          break;
        }

        case 'get_user_history': {
          const { getRecentPlays } = await import('../store/historyStore.js');
          const plays = getRecentPlays(toolCall.input.range || '7d');
          result = { plays };
          break;
        }

        case 'add_to_queue': {
          socket.send(JSON.stringify({
            type: 'music.recommend',
            payload: { songIds: toolCall.input.song_ids },
            timestamp: Date.now()
          }));
          result = { added: toolCall.input.song_ids.length };
          break;
        }

        default:
          result = { error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (err) {
      console.error(`Tool call error (${toolCall.name}):`, err);
    }
  }
}

function handleSongPlayed(payload) {
  try {
    recordPlay(payload, 'complete', payload.source || 'recommend');
    // 更新艺人偏好
    if (payload.artist) {
      updateTagWeight('artist', payload.artist, 0.05);
    }
  } catch { /* ignore tracking errors */ }
}

function handlePlayerControl(socket, payload) {
  socket.send(JSON.stringify({
    type: 'player.state',
    payload,
    timestamp: Date.now()
  }));
}

function buildRecommendReason(input) {
  const parts = [];
  if (input.mood) parts.push(input.mood === 'relaxed' ? '放松' : input.mood === 'energetic' ? '活力' : input.mood);
  if (input.weather) parts.push(input.weather === 'rainy' ? '雨天' : input.weather === 'sunny' ? '晴天' : input.weather);
  if (input.scene) parts.push(input.scene === 'work' ? '工作' : input.scene === 'exercise' ? '运动' : input.scene);
  return parts.length > 0 ? `根据${parts.join('、')}为你推荐` : '为你推荐';
}

function getToolHint(toolName) {
  switch (toolName) {
    case 'recommend_songs': return '正在从你的我喜欢歌单里挑选歌曲...';
    case 'search_songs': return '正在搜索歌曲...';
    case 'search_global': return '正在全网搜索歌曲...';
    case 'get_liked_songs': return '正在读取你的我喜欢歌单...';
    case 'get_weather': return '正在查看天气...';
    default: return '正在处理...';
  }
}

export function broadcastToAll(message) {
  const data = JSON.stringify({ ...message, timestamp: Date.now() });
  for (const socket of connections) {
    try {
      socket.send(data);
    } catch { /* connection closed */ }
  }
}
