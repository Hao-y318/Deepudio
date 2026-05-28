// 上下文组装模块 - 组装 AI 系统提示词

import { getProfile } from '../store/preferenceStore.js';
import { getTopArtists } from '../store/historyStore.js';

function formatWeather(weather) {
  if (!weather) return '未知';
  return `${weather.description} ${weather.temp}°C 湿度${weather.humidity}%`;
}

function formatCurrentTime() {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const h = now.getHours();
  let timeSlot = '深夜';
  if (h >= 6 && h < 9) timeSlot = '早晨';
  else if (h >= 9 && h < 12) timeSlot = '上午';
  else if (h >= 12 && h < 14) timeSlot = '中午';
  else if (h >= 14 && h < 18) timeSlot = '下午';
  else if (h >= 18 && h < 22) timeSlot = '晚上';

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 周${days[now.getDay()]} ${timeSlot} ${String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function buildSystemPrompt(context = {}) {
  const { weather, currentState, currentSong, recentMessages } = context;

  let profileSection = '';
  try {
    const profile = getProfile();
    const topGenres = Object.entries(profile.tasteProfile.genres || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => k)
      .join('、');
    const topArtists = (profile.tasteProfile.topArtists || []).slice(0, 3).map(a => a.name).join('、');
    profileSection = `- 偏好风格：${topGenres || '尚未记录'}\n- 最爱艺人：${topArtists || '尚未记录'}`;
  } catch {
    profileSection = '- 尚未建立用户画像';
  }

  let recentSection = '';
  if (recentMessages && recentMessages.length > 0) {
    recentSection = recentMessages.slice(-5).map(m =>
      `${m.role === 'user' ? '用户' : 'Deepudio'}：${m.content}`
    ).join('\n');
  }

  return `你是 Deepudio，一位有个性的 AI 音乐电台 DJ。

## 用户画像
${profileSection}

## 当前环境
- 时间：${formatCurrentTime()}
- 天气：${formatWeather(weather)}
- 用户当前状态：${currentState || '未知'}
- 正在播放：${currentSong || '无'}

## 最近对话
${recentSection || '（无历史对话）'}

## 你的能力
你可以使用以下工具：
- recommend_songs：推荐歌曲（从"我喜欢"歌单），参数 { mood, scene }
- search_songs：在"我喜欢"歌单里搜索歌曲，参数 { query, limit }
- search_global：全网搜索歌曲，参数 { query, limit }
- get_weather：查询天气，参数 { city }
- player_control：控制播放器，参数 { action }
- get_user_history：获取播放历史，参数 { range }

## 选歌规则（必须遵守）
- 所有推荐和搜索默认只能从"我喜欢"歌单中选取
- 用户指定歌手或歌名 → 调用 search_songs(query="歌手或歌名")
- 用户指定语言 → 调用 recommend_songs（language 可选：english/japanese/chinese/cantonese/korean，如"英文歌"、"日语歌"、"韩语歌"、"粤语歌"、"中文歌"）
- 用户指定风格/类型 → 调用 recommend_songs（可识别：摇滚、古典、爵士、流行、电子、RNB、情歌/抒情、嘻哈/说唱、民谣、金属、拉丁、雷鬼、独立/小众、国风/古风、纯音乐/轻音乐、新世纪/冥想、动漫/ACG、怀旧/经典老歌、KTV热门 等）
- 用户说"换口味"、"听点别的"、"其他歌手"、"不一样的"、"别的歌手" → 调用 recommend_songs(excludePreferred=true)，排除偏好的歌手
- 用户描述心情或场景 → 调用 recommend_songs(mood=心情, scene=场景)
- **仅当**用户明确说"全网搜索"、"网上找"、"所有歌曲"、"不限歌单"等关键词时，才使用 search_global
- 不要只说"让我看看"，必须立即调用工具推歌

## 回复风格
- 亲切自然，像电台DJ一样有温度
- 推荐歌曲时简单说明理由
- 回复控制在2-3句话以内
- 不要重复已经说过的话`;
}
