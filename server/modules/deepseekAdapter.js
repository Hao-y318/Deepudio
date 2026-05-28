// DeepSeek API 适配器 (OpenAI 兼容格式)

import { loadConfig } from '../config.js';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_songs',
      description: '在用户我喜欢歌单里搜索歌曲。用户指定歌手/歌名时必须用此工具。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（歌手名或歌名）' },
          limit: { type: 'number', description: '返回数量，默认10' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_global',
      description: '全网搜索歌曲。仅在用户明确说"全网搜索"、"网上找"、"所有歌曲里搜"、"不限我喜欢"等关键词时才调用。默认不要使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
          limit: { type: 'number', description: '返回数量，默认10' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recommend_songs',
      description: '根据心情/场景/语言/风格从我喜欢歌单推荐歌曲。当用户说"英文歌""日语歌""摇滚""古典"等关键词，或者"换口味""听点不一样的""其他歌手"时使用。',
      parameters: {
        type: 'object',
        properties: {
          mood: { type: 'string', description: '情绪：relaxed/energetic/melancholy/happy' },
          scene: { type: 'string', description: '场景：work/commute/exercise/relax' },
          language: { type: 'string', description: '语言过滤：english/japanese/korean/chinese/cantonese' },
          genre: { type: 'string', description: '风格过滤：rock/classical/jazz/pop/electronic 等' },
          excludePreferred: { type: 'boolean', description: '用户说"换口味""别的歌手"时设为true，排除偏好歌手' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市天气',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: '城市名' } },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'player_control',
      description: '控制播放器',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['play', 'pause', 'next', 'prev', 'volume'] }
        },
        required: ['action']
      }
    }
  }
];

function getClient() {
  const config = loadConfig();
  if (!config.ai.apiKey) {
    throw new Error('API Key 未配置，请在设置页填入 DeepSeek API Key');
  }
  return {
    baseUrl: config.ai.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: config.ai.apiKey,
    model: config.ai.model || 'deepseek-v4-pro',
    maxTokens: config.ai.maxTokens || 1024
  };
}

export async function chat(systemPrompt, messages, onStream) {
  const cfg = getClient();

  // 构建消息列表：system + history + user
  const apiMessages = [
    { role: 'system', content: systemPrompt }
  ];

  for (const msg of messages) {
    apiMessages.push({
      role: msg.role,
      content: msg.content
    });
  }

  const body = {
    model: cfg.model,
    messages: apiMessages,
    max_tokens: cfg.maxTokens,
    tools: TOOLS,
    stream: false
  };

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DeepSeek API error (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error('DeepSeek API 返回为空');
  }

  const content = choice.message?.content || '';
  const toolCalls = (choice.message?.tool_calls || []).map(tc => ({
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || '{}')
  }));

  // 一次性输出完整内容（不做碎片化模拟stream）
  if (onStream && content) {
    onStream({ type: 'text', content });
  }

  return { content, toolCalls };
}

// 带工具调用的完整对话循环
export async function chatWithTools(systemPrompt, messages, toolExecutor, onStream) {
  const MAX_ROUNDS = 5;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await chat(systemPrompt, messages, round === 0 ? onStream : null);

    // 没有工具调用，返回结果
    if (result.toolCalls.length === 0) {
      return result;
    }

    // 执行工具调用
    const toolResults = [];
    for (const tc of result.toolCalls) {
      try {
        const output = await toolExecutor(tc.name, tc.input);
        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(output)
        });
      } catch (err) {
        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: err.message })
        });
      }
    }

    // 将AI消息和工具结果加入历史
    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) }
      }))
    });

    for (const tr of toolResults) {
      messages.push(tr);
    }
  }

  return { content: '', toolCalls: [] };
}

export async function classifyIntent(userInput) {
  const cfg = getClient();

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `分析用户消息意图，选择最匹配的一个：
- music_request：请求推荐或播放音乐
- music_control：控制播放器
- weather_query：询问天气
- weather_music：根据天气推荐音乐
- chat_casual：日常闲聊
- profile_query：查询个人听歌数据
- settings_change：修改设置

只返回JSON：{"intent":"...","confidence":0-1,"slots":{}}`
        },
        { role: 'user', content: userInput }
      ]
    })
  });

  if (!resp.ok) {
    return { intent: 'chat_casual', confidence: 0.5, slots: {}, raw: userInput };
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fallback */ }

  return { intent: 'chat_casual', confidence: 0.5, slots: {}, raw: userInput };
}

export { TOOLS };
