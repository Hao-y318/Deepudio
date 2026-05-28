// Claude API 适配器 - 封装与 Claude API 的所有交互

import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../config.js';

const TOOLS = [
  {
    name: 'search_songs',
    description: '搜索歌曲，返回匹配列表',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '返回数量，默认5', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'recommend_songs',
    description: '基于上下文智能推荐歌曲',
    input_schema: {
      type: 'object',
      properties: {
        mood: { type: 'string', description: '情绪：relaxed/energetic/melancholy/happy' },
        genre: { type: 'string', description: '音乐风格' },
        weather: { type: 'string', description: '天气关联：sunny/rainy/snowy/windy/cloudy' },
        scene: { type: 'string', description: '场景：work/commute/exercise/relax' }
      }
    }
  },
  {
    name: 'get_weather',
    description: '获取指定城市天气',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名' }
      },
      required: ['city']
    }
  },
  {
    name: 'player_control',
    description: '控制播放器',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['play', 'pause', 'next', 'prev', 'volume'] },
        value: { type: 'number', description: '音量值(0-100)，仅action=volume时需要' }
      },
      required: ['action']
    }
  },
  {
    name: 'get_user_history',
    description: '获取用户播放历史',
    input_schema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['7d', '30d', 'all'], description: '时间范围', default: '7d' }
      }
    }
  },
  {
    name: 'add_to_queue',
    description: '将歌曲加入播放队列',
    input_schema: {
      type: 'object',
      properties: {
        song_ids: { type: 'array', items: { type: 'string' }, description: '歌曲ID列表' }
      },
      required: ['song_ids']
    }
  }
];

let client = null;

function getClient() {
  if (!client) {
    const config = loadConfig();
    if (!config.claude.apiKey) {
      throw new Error('Claude API Key 未配置，请在设置页填入');
    }
    client = new Anthropic({ apiKey: config.claude.apiKey });
  }
  return client;
}

export function resetClient() {
  client = null;
}

export async function chat(systemPrompt, messages, onStream) {
  const config = loadConfig();
  const anthropic = getClient();

  const params = {
    model: config.claude.model,
    max_tokens: config.claude.maxTokens,
    system: systemPrompt,
    messages,
    tools: TOOLS,
    stream: true
  };

  let fullContent = '';
  let toolCalls = [];
  let currentToolCall = null;

  const stream = await anthropic.messages.stream(params);

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        if (onStream) onStream({ type: 'text', content: event.delta.text });
      } else if (event.delta.type === 'input_json_delta') {
        if (currentToolCall) {
          currentToolCall.json += event.delta.partial_json;
        }
      }
    } else if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        currentToolCall = {
          id: event.content_block.id,
          name: event.content_block.name,
          json: ''
        };
      }
    } else if (event.type === 'content_block_stop') {
      if (currentToolCall) {
        try {
          currentToolCall.input = JSON.parse(currentToolCall.json);
        } catch {
          currentToolCall.input = {};
        }
        toolCalls.push(currentToolCall);
        currentToolCall = null;
      }
    }
  }

  return { content: fullContent, toolCalls };
}

export async function classifyIntent(userInput) {
  const config = loadConfig();
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: config.claude.model,
    max_tokens: 200,
    messages: [{ role: 'user', content: userInput }],
    system: `分析用户消息的意图，从以下选项中选择最匹配的一个：
- music_request：请求推荐或播放音乐
- music_control：控制播放器
- weather_query：询问天气
- weather_music：根据天气推荐音乐
- chat_casual：日常闲聊
- profile_query：查询个人听歌数据
- settings_change：修改设置

只返回JSON：{"intent":"...","confidence":0-1,"slots":{}}`
  });

  try {
    const text = response.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fallback */ }

  return { intent: 'chat_casual', confidence: 0.5, slots: {}, raw: userInput };
}

export { TOOLS };
