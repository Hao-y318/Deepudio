// 音乐搜索/播放 API 路由

import { Readable } from 'stream';
import { searchSongs, getSongUrl, getLyrics, getUserPlaylists, getPlaylistDetail } from '../services/netease.js';
import { getLocalSongById, refreshLibrary, getLocalSongs, searchLocalSongs } from '../services/localMusic.js';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';

export default async function musicRoutes(fastify) {
  fastify.get('/api/music/search', async (request) => {
    const query = request.query.q;
    const limit = parseInt(request.query.limit) || 10;
    if (!query) return { error: '缺少搜索关键词' };
    const songs = await searchSongs(query, limit);
    return { songs };
  });

  fastify.get('/api/music/song-url', async (request) => {
    const songId = request.query.id;
    if (!songId) return { error: '缺少歌曲ID' };
    return await getSongUrl(songId);
  });

  fastify.get('/api/music/play/:songId', async (request, reply) => {
    const songId = request.params.songId;
    if (!songId) return reply.code(400).send({ error: '缺少歌曲ID' });

    // 本地/JSON 歌
    if (songId.startsWith('local_') || songId.startsWith('json_')) {
      const song = getLocalSongById(songId);

      // 1. 有本地文件 → 直接返回文件流
      if (song?.localPath && existsSync(song.localPath)) {
        const ext = extname(song.localPath).toLowerCase();
        const mimeMap = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
          '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac' };
        reply.header('Content-Type', mimeMap[ext] || 'audio/mpeg');
        return reply.send(createReadStream(song.localPath));
      }

      // 2. 有网易云ID → 流式转发
      if (song?.neteaseId) {
        const audioRes = await fetch(`http://127.0.0.1:3000/audio?id=${song.neteaseId.replace('netease_','')}&br=320000`);
        if (audioRes.ok) {
          reply.header('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
          return reply.send(Readable.fromWeb(audioRes.body));
        }
      }
      // 3. 歌名搜索
      if (song?.title) {
        const results = await searchSongs(`${song.title} ${song.artist}`, 1);
        if (results.length > 0) {
          const audioRes = await fetch(`http://127.0.0.1:3000/audio?id=${results[0].id.replace('netease_','')}&br=320000`);
          if (audioRes.ok) {
            reply.header('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
            return reply.send(Readable.fromWeb(audioRes.body));
          }
        }
      }
      return reply.code(404).send({ error: '无法播放' });
    }

    // 网易云歌曲：通过NCM代理获取音频并流式转发
    try {
      const audioRes = await fetch(`http://127.0.0.1:3000/audio?id=${songId.replace('netease_', '')}&br=320000`);
      if (!audioRes.ok) return reply.code(404).send({ error: '无播放链接' });

      const ct = audioRes.headers.get('content-type') || 'audio/mpeg';
      const cl = audioRes.headers.get('content-length');
      reply.header('Content-Type', ct);
      if (cl) reply.header('Content-Length', cl);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Cache-Control', 'no-cache');

      return reply.send(Readable.fromWeb(audioRes.body));
    } catch (err) {
      return reply.code(404).send({ error: '播放异常' });
    }
  });

  fastify.get('/api/music/lyrics', async (request) => {
    const songId = request.query.id;
    if (!songId) return { error: '缺少歌曲ID' };
    const lyrics = await getLyrics(songId);
    return { lyrics };
  });

  // 本地音乐接口
  fastify.get('/api/local/songs', async () => {
    return { songs: getLocalSongs() };
  });

  fastify.get('/api/local/search', async (request) => {
    const q = request.query.q;
    if (!q) return { songs: [] };
    return { songs: searchLocalSongs(q) };
  });

  fastify.post('/api/local/rescan', async () => {
    refreshLibrary();
    return { songs: getLocalSongs(), count: getLocalSongs().length };
  });

  fastify.get('/api/netease/playlists', async () => {
    const playlists = await getUserPlaylists();
    return { playlists };
  });

  // 获取歌单列表（用于选择多个歌单）
  fastify.get('/api/netease/all-playlists', async () => {
    const playlists = await getUserPlaylists();
    return {
      playlists: playlists.map(p => ({
        id: String(p.id), name: p.name || '未命名', trackCount: p.trackCount || 0,
        specialType: p.specialType || 0, isLiked: p.specialType === 5
      }))
    };
  });

  fastify.get('/api/netease/playlist-detail', async (request) => {
    const id = request.query.id;
    if (!id) return { error: '缺少歌单ID' };
    const songs = await getPlaylistDetail(id);
    return { songs };
  });
}
