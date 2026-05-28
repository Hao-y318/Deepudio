// 本地音乐服务 —— 扫描文件夹 + JSON导入，不受API限制

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { loadConfig } from '../config.js';

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma', '.ape']);

let localCache = [];
let jsonSongs = [];

export function scanLocalFolder() {
  const config = loadConfig();
  const folder = config.localMusic?.folder || '';

  if (!folder || !existsSync(folder)) {
    localCache = [];
    return [];
  }

  const files = [];
  try {
    scanDir(folder, files);
  } catch { /* ignore */ }

  localCache = files.map((filePath, i) => {
    const name = basename(filePath, extname(filePath));
    // 尝试解析 "歌手 - 歌名" 或 "歌名 - 歌手" 格式
    let title = name, artist = '本地音乐';
    const sep = name.includes(' - ') ? ' - ' : name.includes('-') ? '-' : null;
    if (sep) {
      const parts = name.split(sep);
      if (parts.length === 2) {
        artist = parts[0].trim();
        title = parts[1].trim();
        // 如果第一部分看起来不像人名，交换
        if (!/[a-zA-Z一-鿿]{2,}/.test(artist)) {
          [artist, title] = [title, artist];
        }
      }
    }

    return {
      id: `local_${i}`,
      source: 'local',
      title,
      artist,
      album: '',
      duration: 0,
      coverUrl: '',
      localPath: filePath
    };
  });

  return localCache;
}

function scanDir(dir, result) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    try {
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        scanDir(fullPath, result);
      } else if (AUDIO_EXTS.has(extname(entry).toLowerCase())) {
        result.push(fullPath);
      }
    } catch { /* skip unreadable files */ }
  }
}

// JSON 歌单导入
export function importJSONPlaylist(filePath) {
  if (!filePath || !existsSync(filePath)) {
    jsonSongs = [];
    return [];
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    let tracks = [];

    // 网易云歌单导出格式: { playlist: { tracks: [...] } }
    if (data.playlist?.tracks) {
      tracks = data.playlist.tracks;
    }
    // 网易云 liked 导出格式: { data: { dailySongs: [...] } } 或简单数组
    else if (data.data?.dailySongs) {
      tracks = data.data.dailySongs;
    }
    // 数组格式: [{ name/title, ar/artist, ... }]
    else if (Array.isArray(data)) {
      tracks = data;
    }
    // 对象含 songs/tracks 字段
    else if (Array.isArray(data.songs)) {
      tracks = data.songs;
    }
    else if (Array.isArray(data.tracks)) {
      tracks = data.tracks;
    }

    jsonSongs = tracks.map((t, i) => {
      const title = t.name || t.title || t.songName || '未知歌名';
      const artist = t.ar ? t.ar.map(a => a.name || a).join(' / ') :
                     t.artists ? t.artists.map(a => a.name || a).join(' / ') :
                     t.artist || t.singer || '未知歌手';
      const album = t.al?.name || t.album?.name || t.album || '';
      const localPath = t.path || t.filePath || t.localPath || '';
      // 如果JSON里带了网易云ID，直接用
      const neteaseId = t.id ? `netease_${t.id}` : null;

      return {
        id: neteaseId || `json_${i}`,
        source: 'json',
        neteaseId,
        title,
        artist,
        album,
        duration: Math.floor((t.dt || t.duration || 0) / 1000),
        coverUrl: t.al?.picUrl || t.album?.picUrl || '',
        localPath,
        hasFile: !!localPath && existsSync(localPath)
      };
    });

    return jsonSongs;
  } catch (err) {
    console.error('JSON import error:', err.message);
    jsonSongs = [];
    return [];
  }
}

// 合并所有来源（文件夹 + JSON）
function buildCache() {
  const config = loadConfig();
  const folderSongs = scanLocalFolder();
  const jsonPath = config.localMusic?.jsonFile || '';
  const imported = importJSONPlaylist(jsonPath);
  localCache = [...folderSongs, ...imported];
  return localCache;
}

export function refreshLibrary() {
  buildCache();
  return localCache;
}

export function getLocalSongById(id) {
  return localCache.find(s => s.id === id) || null;
}

export function searchLocalSongs(query) {
  const q = query.toLowerCase();
  return localCache.filter(s =>
    s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );
}

export function getLocalSongs() {
  return localCache;
}

// 启动时构建缓存
buildCache();
