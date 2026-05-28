// 意图分流模块 - 解析用户输入，识别意图，分发到对应处理流程

const INTENT_RULES = [
  {
    intent: 'music_control',
    patterns: [/^(下一首|跳过|暂停|播放|继续|停止|声音[大小]|音量)/],
    slots: (match) => ({ action: match[1] })
  },
  {
    intent: 'music_request',
    patterns: [/来点(.+)音乐/, /放一首(.+)/, /我想听(.+)/, /播放(.+)/, /推荐(.+?)歌/],
    slots: (match) => ({ query: match[1] })
  },
  {
    intent: 'weather_music',
    patterns: [/下雨天.*听/, /晴天.*听.*什么/, /天气.*适合.*听/],
    slots: () => ({ weather_hint: 'auto' })
  },
  {
    intent: 'weather_query',
    patterns: [/今天天气/, /天气怎么样/, /外面.*冷.*热/],
    slots: () => ({})
  },
  {
    intent: 'profile_query',
    patterns: [/我最近.*听.*什么/, /我.*喜好/, /我.*品味/],
    slots: () => ({})
  },
  {
    intent: 'settings_change',
    patterns: [/把.*改成/, /设置.*城市/, /切换.*模式/],
    slots: (match) => ({ raw: match[0] })
  }
];

export function classifyIntent(userInput) {
  const trimmed = userInput.trim();

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          intent: rule.intent,
          confidence: 0.9,
          slots: rule.slots(match),
          raw: trimmed
        };
      }
    }
  }

  // 未匹配规则，交给 Claude 分类
  return {
    intent: 'unknown',
    confidence: 0.3,
    slots: {},
    raw: trimmed
  };
}

// Claude 辅助意图分类的提示词
export const INTENT_CLASSIFY_PROMPT = `分析用户消息的意图，从以下选项中选择最匹配的一个：
- music_request：请求推荐或播放音乐
- music_control：控制播放器（播放/暂停/下一首/音量）
- weather_query：询问天气
- weather_music：根据天气推荐音乐
- chat_casual：日常闲聊
- profile_query：查询个人听歌数据
- settings_change：修改设置

只返回 JSON：{"intent":"...","confidence":0-1,"slots":{}}`;
