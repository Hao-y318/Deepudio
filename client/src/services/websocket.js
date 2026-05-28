// WebSocket 连接管理

import { addMessage, isStreaming, weather, userState, addToQueue, currentSong } from '../app/store.js';

let ws = null;
let reconnectTimer = null;
let listeners = new Map();

export function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWSMessage(msg);
    } catch (err) {
      console.error('WS message parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting in 3s...');
    reconnectTimer = setTimeout(connectWS, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

function handleWSMessage(msg) {
  const { type, payload } = msg;

  // 通知自定义监听器
  const cbs = listeners.get(type);
  if (cbs) {
    for (const cb of cbs) cb(payload);
  }

  switch (type) {
    case 'chat.stream':
      if (payload.done) {
        isStreaming.value = false;
      } else {
        // 追加到最新AI消息
        isStreaming.value = true;
        const msgs = [...isStreaming._value !== false ? [] : []];
        // 简单处理：触发监听器
        const streamCbs = listeners.get('chat.stream.append');
        if (streamCbs) {
          for (const cb of streamCbs) cb(payload.content);
        }
      }
      break;

    case 'chat.intent':
      // 意图识别结果，可用于UI展示
      break;

    case 'music.recommend':
      if (payload.songs && payload.songs.length > 0) {
        // 加入队列
        for (const song of payload.songs) {
          addToQueue(song);
        }
        // 在聊天框展示歌曲（可点击播放）
        addMessage('assistant',
          `为你找到 ${payload.songs.length} 首歌` + (payload.reason ? `（${payload.reason}）` : ''),
          { songs: payload.songs }
        );
      }
      break;

    case 'music.search_result':
      if (payload.songs && payload.songs.length > 0) {
        addMessage('assistant',
          `搜索"${payload.query}"找到 ${payload.songs.length} 首歌`,
          { songs: payload.songs }
        );
      }
      break;

    case 'weather.update':
      weather.value = payload;
      break;

    case 'scheduler.greeting':
      addMessage('assistant', payload.message, { greetingType: payload.greetingType });
      break;

    case 'scheduler.idle':
      addMessage('assistant', payload.message, { type: 'idle' });
      break;

    case 'scheduler.weather_change':
      addMessage('assistant', payload.message, { weather: payload.weather });
      break;

    case 'tts.audio':
      // 播放TTS音频
      playTTSAudio(payload.audio, payload.format);
      break;

    case 'system.error':
      console.error('Server error:', payload);
      break;
  }
}

function playTTSAudio(base64, format) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: `audio/${format}` });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.8;
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  } catch (err) {
    console.error('TTS playback error:', err);
  }
}

export function sendWS(type, payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

export function onWS(type, callback) {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type).add(callback);

  return () => {
    listeners.get(type)?.delete(callback);
  };
}

export function disconnectWS() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
