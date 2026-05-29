// 网易云音乐服务 —— 通过 @unblockneteasemusic 代理
// 自动解锁VIP歌曲：网易云没有的链接 → 酷狗/咪咕/酷我替代

import { loadConfig } from '../config.js';

const PROXY_BASE = 'http://127.0.0.1:3000';
const NETEASE_BASE = 'https://music.163.com';
let proxyAvailable = false;
let proxyChecked = false;

export function setProxyAvailable(val) { proxyAvailable = val; proxyChecked = true; }

async function checkProxy() {
  if (proxyChecked) return;
  try {
    const r = await fetch(`${PROXY_BASE}/search?keywords=test&limit=1`);
    if (r.ok) { proxyAvailable = true; }
  } catch {}
  proxyChecked = true;
}

function getBase() {
  if (!proxyChecked) checkProxy().catch(() => {});
  return proxyAvailable ? PROXY_BASE : NETEASE_BASE;
}

function getCookie() {
  const config = loadConfig();
  return config.netease.cookie || '';
}

async function apiGet(path, params = {}) {
  const base = getBase();
  const url = new URL(path, base);

  // 走代理时传 cookie 作为 query param
  if (proxyAvailable) {
    const cookie = getCookie();
    if (cookie) url.searchParams.set('cookie', cookie);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const headers = proxyAvailable
    ? {}  // 代理不需要伪造header
    : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com',
        'Cookie': getCookie()
      };

  const resp = await fetch(url.toString(), { headers });
  return resp.json();
}

function formatTrack(t) {
  return {
    id: `netease_${t.id}`,
    source: 'netease',
    neteaseId: t.id,
    title: t.name || '',
    artist: (t.ar || []).map(a => a.name).join(' / ') || '未知歌手',
    album: t.al?.name || '',
    duration: Math.floor((t.dt || 0) / 1000),
    coverUrl: t.al?.picUrl || ''
  };
}

export function clearLikedCache() {
  likedPlaylistIdCache = null;
  likedPlaylistNameCache = null;
}

// 搜索（走代理自动解锁）
export async function searchSongs(query, limit = 10) {
  const data = await apiGet('/search', { keywords: query, limit: String(limit) });
  const songs = data?.result?.songs || [];
  return songs.map(formatTrack);
}

// 播放链接（走代理：VIP歌自动找替代源）
const urlCache = new Map();

export async function getSongUrl(songId, quality = 'auto') {
  const id = String(songId).replace('netease_', '');
  const cacheKey = id;
  const cached = urlCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 180000) return cached.data;

  try {
    // 走代理获取URL（自动解锁VIP + 替代源）
    const data = await apiGet('/song/url', { id });
    const item = data?.data?.[0];

    if (item?.url) {
      const result = { url: item.url, needVip: false, br: item.br || 128000 };
      urlCache.set(cacheKey, { data: result, time: Date.now() });
      return result;
    }

    return { url: null, needVip: true };
  } catch {
    return { url: null, needVip: false };
  }
}

// 歌词
export async function getLyrics(songId) {
  const id = String(songId).replace('netease_', '');
  const data = await apiGet('/lyric', { id });
  return data?.lrc?.lyric || '';
}

// 用户歌单
export async function getUserPlaylists() {
  const data = await apiGet('/user/playlist', { limit: '50' });
  return data?.playlist || [];
}

// 歌单详情
export async function getPlaylistDetail(playlistId, limit = 100) {
  const data = await apiGet('/playlist/detail', { id: String(playlistId), n: String(Math.min(limit, 1000)) });
  if (!data?.playlist?.tracks) return [];
  return data.playlist.tracks.map(formatTrack);
}

// 批量检查
export async function filterPlayable(songs) {
  // 走代理后几乎所有歌都能放，不用过滤
  return songs;
}

// "我喜欢"歌单
let likedPlaylistIdCache = null;
let likedPlaylistNameCache = null;

export function getLikedPlaylistName() { return likedPlaylistNameCache || '我喜欢'; }

export async function getLikedPlaylistId() {
  if (likedPlaylistIdCache) return likedPlaylistIdCache;

  const config = loadConfig();
  if (config.netease.likedPlaylistId) {
    likedPlaylistIdCache = config.netease.likedPlaylistId;
    return likedPlaylistIdCache;
  }

  try {
    const playlists = await getUserPlaylists();
    for (const pl of playlists) {
      if (pl.specialType === 5) {
        likedPlaylistIdCache = String(pl.id);
        likedPlaylistNameCache = pl.name;
        const { updateConfig } = await import('../config.js');
        updateConfig({ netease: { likedPlaylistId: String(pl.id) } });
        return likedPlaylistIdCache;
      }
    }
  } catch { /* ignore */ }

  return null;
}

// 获取所有已选择的歌单的歌曲（"我喜欢" + 用户选的额外歌单）
export async function getAllPlaylistSongs(limit = 2000) {
  const songs = [];
  const seen = new Set();

  // 额外歌单保留至少 40% 配额
  const config = loadConfig();
  const extraIds = config.netease.extraPlaylistIds || [];
  const hasExtra = extraIds.length > 0;
  const likedQuota = hasExtra ? Math.floor(limit * 0.6) : limit;

  // 先加"我喜欢"
  const likedId = await getLikedPlaylistId();
  if (likedId) {
    const liked = await getPlaylistDetail(likedId, Math.min(likedQuota, 2000));
    for (const s of liked) { if (!seen.has(s.id)) { seen.add(s.id); songs.push(s); } }
  }

  // 再加用户选择的额外歌单
  for (const pid of extraIds) {
    if (songs.length >= limit) break;
    const tracks = await getPlaylistDetail(pid, Math.min(limit - songs.length, 200));
    for (const s of tracks) { if (!seen.has(s.id)) { seen.add(s.id); songs.push(s); } }
  }

  return songs;
}

export async function getLikedSongs(limit = 2000) {
  return await getAllPlaylistSongs(limit);
}
