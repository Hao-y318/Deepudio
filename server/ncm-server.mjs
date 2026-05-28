// NCM 代理服务器 - 网易云加密API + 多源匹配（酷狗/咪咕/酷我）
// 端口 3000

import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 多源匹配：网易云没有的歌去酷狗/咪咕/酷我找
let matchSong = null;
try {
  const mod = await import('@neteasecloudmusicapienhanced/unblockmusic-utils');
  matchSong = mod.matchID || mod.default?.matchID;
  if (matchSong) console.log('[ncm] Multi-source matching loaded (kugou/migu/kuwo)');
} catch (e) {
  console.warn('[ncm] Multi-source not available:', e.message);
}

function loadCookie() {
  try {
    const configPath = join(__dirname, '..', 'data', 'config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return config.netease?.cookie || '';
    }
  } catch {}
  return '';
}

const PORT = 3000;
const BASE = 'https://music.163.com';
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// WeAPI encryption
const SECRET_KEY = '0CoJUm6Qyw8W8jud';
const IV = '0102030405060708';
const MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const PUBKEY = '010001';

function aesEncrypt(text, key) {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, IV);
  return cipher.update(text, 'utf8', 'base64') + cipher.final('base64');
}

function weapiEncrypt(text) {
  const randKey = crypto.randomBytes(16).toString('hex').slice(0, 16);
  const first = aesEncrypt(text, SECRET_KEY);
  const second = aesEncrypt(first, randKey);
  // RSA
  const reversed = randKey.split('').reverse().join('');
  const hex = Buffer.from(reversed, 'utf8').toString('hex');
  const biText = BigInt('0x' + (hex || '0'));
  const biMod = BigInt('0x' + MODULUS);
  const biPub = BigInt('0x' + PUBKEY);
  let result = 1n, base = biText % biMod, exp = biPub;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % biMod;
    exp = exp / 2n;
    base = (base * base) % biMod;
  }
  const encSecKey = result.toString(16).padStart(256, '0');
  return { params: second, encSecKey };
}

async function ncmPost(path, body) {
  const cookie = loadCookie();
  const { params, encSecKey } = weapiEncrypt(JSON.stringify(body));
  const form = `params=${encodeURIComponent(params)}&encSecKey=${encodeURIComponent(encSecKey)}`;

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'User-Agent': AGENT,
      Referer: 'https://music.163.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: form
  });
  return res.json();
}

async function ncmGet(path, params = {}) {
  const cookie = loadCookie();
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': AGENT, Referer: 'https://music.163.com/', Cookie: cookie }
  });
  return res.json();
}

function mapSong(raw) {
  const artists = raw.artists ?? raw.ar ?? [];
  const album = raw.album ?? raw.al ?? {};
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    ar: artists.map(a => ({ name: a.name })),
    al: { name: album.name ?? '', picUrl: album.picUrl ?? '' },
    dt: raw.duration ?? raw.dt ?? 0
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (url.pathname === '/search') {
      const kw = url.searchParams.get('keywords') ?? '';
      const limit = Number(url.searchParams.get('limit') ?? '10');
      const data = await ncmPost('/weapi/search/get', { s: kw, type: 1, limit, offset: 0 });
      const songs = (data?.result?.songs ?? []).map(mapSong);
      res.end(JSON.stringify({ result: { songs } }));

    } else if (url.pathname === '/song/url') {
      const id = url.searchParams.get('id') ?? '';
      const br = url.searchParams.get('br') ?? '320000';

      let data = await ncmPost('/weapi/song/enhance/player/url/v1', {
        ids: `["${id}"]`, level: 'exhigh', encodeType: 'mp3', br: Number(br)
      });

      if (!data?.data?.[0]?.url) {
        data = await ncmPost('/weapi/song/enhance/player/url', { ids: `["${id}"]`, br: Number(br) });
      }

      // 网易云没有链接 → 多源匹配（酷狗/咪咕/酷我）
      if (!data?.data?.[0]?.url && matchSong) {
        try {
          const alt = await matchSong(id);
          if (alt?.data?.url) {
            if (!data) data = { data: [{}] };
            if (!data.data) data.data = [{}];
            if (!data.data[0]) data.data[0] = {};
            data.data[0].url = alt.data.url;
            data.data[0].br = alt.data.br || 320000;
          }
        } catch {}
      }

      res.end(JSON.stringify(data));

    } else if (url.pathname === '/lyric') {
      const id = url.searchParams.get('id') ?? '';
      const data = await ncmGet('/api/song/lyric', { id, lv: 1, tv: 1 });
      res.end(JSON.stringify(data));

    } else if (url.pathname === '/playlist/detail') {
      const id = url.searchParams.get('id') ?? '';
      const n = Number(url.searchParams.get('n') ?? '100');
      const data = await ncmPost('/weapi/v6/playlist/detail', { id, n, s: 0 });
      const tracks = (data?.playlist?.tracks ?? []).map(mapSong);
      res.end(JSON.stringify({ playlist: { tracks } }));

    } else if (url.pathname === '/user/playlist') {
      let uid = url.searchParams.get('uid') ?? '';
      // 没有UID时自动从cookie获取
      if (!uid) {
        try {
          const acct = await ncmPost('/weapi/nuser/account/get', {});
          uid = String(acct.account?.id || acct.profile?.userId || '');
        } catch { uid = ''; }
      }
      if (!uid) { res.end(JSON.stringify({ playlist: [] })); return; }
      const data = await ncmPost('/weapi/user/playlist', { uid, limit: 50, offset: 0 });
      const playlists = (data?.playlist ?? []).map(p => ({
        id: String(p.id), name: p.name ?? '', trackCount: p.trackCount ?? 0,
        specialType: p.specialType ?? 0
      }));
      res.end(JSON.stringify({ playlist: playlists }));

    } else if (url.pathname === '/audio') {
      // 音频代理：获取音频并转发，绕过跨域/地区限制
      const id = url.searchParams.get('id') ?? '';
      const br = url.searchParams.get('br') ?? '320000';

      let audioUrl = null;
      // 1. 先试网易云官方
      let data = await ncmPost('/weapi/song/enhance/player/url/v1', {
        ids: `["${id}"]`, level: 'exhigh', encodeType: 'mp3', br: Number(br)
      });
      audioUrl = data?.data?.[0]?.url;
      if (!audioUrl) {
        data = await ncmPost('/weapi/song/enhance/player/url', {
          ids: `["${id}"]`, br: Number(br)
        });
        audioUrl = data?.data?.[0]?.url;
      }
      // 2. 多源匹配
      if (!audioUrl && matchSong) {
        try {
          const alt = await matchSong(id);
          if (alt?.data?.url) audioUrl = alt.data.url;
        } catch {}
      }

      if (!audioUrl) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'no audio url' }));
        return;
      }

      // 3. 从源站拉音频转发
      try {
        const audioRes = await fetch(audioUrl, {
          headers: { 'User-Agent': AGENT, Referer: 'https://music.163.com/' }
        });
        if (!audioRes.ok) {
          // CDN拒绝 → 再试多源
          if (matchSong) {
            const alt = await matchSong(id);
            if (alt?.data?.url) {
              const retry = await fetch(alt.data.url, {
                headers: { 'User-Agent': AGENT }
              });
              if (retry.ok) {
                res.setHeader('Content-Type', 'audio/mpeg');
                const reader = retry.body.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(value);
                }
                res.end();
                return;
              }
            }
          }
          res.statusCode = audioRes.status;
          res.end(JSON.stringify({ error: `CDN ${audioRes.status}` }));
          return;
        }

        res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
        const contentLength = audioRes.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.setHeader('Accept-Ranges', 'bytes');

        const reader = audioRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }

    } else if (url.pathname === '/nuser/account/get') {
      const data = await ncmPost('/weapi/subcount', {});
      res.end(JSON.stringify(data));

    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found' }));
    }
  } catch (err) {
    console.error('[ncm]', err.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`NCM proxy running on http://127.0.0.1:${PORT} (weapi encrypt)`);
  // 通知netease服务
  import('./services/netease.js').then(m => m.setProxyAvailable(true)).catch(() => {});
});
