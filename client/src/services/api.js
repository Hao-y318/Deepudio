// 后端 API 通信封装

const BASE = '';

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const resp = await fetch(`${BASE}${path}`, options);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  return resp.json();
}

export const api = {
  // 音乐
  searchSongs: (q, limit = 10) => request('GET', `/api/music/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  getSongUrl: (id) => request('GET', `/api/music/song-url?id=${id}`),
  getLyrics: (id) => request('GET', `/api/music/lyrics?id=${id}`),

  // 天气
  getWeather: (city) => request('GET', `/api/weather${city ? `?city=${encodeURIComponent(city)}` : ''}`),

  // 用户画像
  getProfile: () => request('GET', '/api/profile'),
  getHistory: (range = '7d') => request('GET', `/api/profile/history?range=${range}`),
  updateTag: (data) => request('PUT', '/api/profile/tags', data),

  // 设置
  getSettings: () => request('GET', '/api/settings'),
  updateSettings: (data) => request('PUT', '/api/settings', data),

  // 歌单
  getNetEasePlaylists: () => request('GET', '/api/netease/all-playlists'),

  // 健康检查
  health: () => request('GET', '/api/health')
};
