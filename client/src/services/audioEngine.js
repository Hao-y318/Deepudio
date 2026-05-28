// 音频播放引擎 —— 网易云官方外链播放器 + Audio兜底

import { currentSong, isPlaying, progress, volume, playMode, queue, queueIndex, playSong } from '../app/store.js';
import { sendWS } from './websocket.js';

let audioElement = null;
let neteaseFrame = null;

export function initAudioEngine() {
  audioElement = new Audio();
  audioElement.crossOrigin = 'anonymous';

  audioElement.addEventListener('timeupdate', () => {
    const dur = audioElement.duration;
    if (dur && isFinite(dur) && dur > 0) {
      progress.value = (audioElement.currentTime / dur) * 100;
    } else if (currentSong.value?.duration) {
      progress.value = (audioElement.currentTime / currentSong.value.duration) * 100;
    }
  });

  audioElement.addEventListener('ended', () => { handleSongEnd(); });
  audioElement.addEventListener('error', () => {
    isPlaying.value = false;
    setTimeout(() => { if (!isPlaying.value && queue.value.length > 0) next(); }, 1000);
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
  }
}

// 网易云官方 iframe 播放器
function createNeteaseFrame(id) {
  const existing = document.getElementById('netease-player-frame');
  if (existing) existing.remove();

  const frame = document.createElement('iframe');
  frame.id = 'netease-player-frame';
  frame.style.cssText = 'display:none;width:0;height:0;border:0';
  // 网易云官方外链播放器
  frame.src = `https://music.163.com/outchain/player?type=2&id=${id}&auto=1&height=0`;
  document.body.appendChild(frame);
  neteaseFrame = frame;
}

function removeNeteaseFrame() {
  if (neteaseFrame) { neteaseFrame.remove(); neteaseFrame = null; }
  const existing = document.getElementById('netease-player-frame');
  if (existing) existing.remove();
}

export function play(song) {
  currentSong.value = song;
  queueIndex.value = queue.value.findIndex(s => s.id === song.id);
  isPlaying.value = true;
  progress.value = 0;

  // 通知后端记录播放（积累偏好）
  sendWS('player.played', {
    id: song.id, title: song.title, artist: song.artist,
    duration: song.duration, source: song.source
  });

  const neteaseId = String(song.neteaseId || song.id).replace('netease_', '');

  // 网易云歌曲 → 用官方外链播放器（VIP/高音质都有）
  if (song.source === 'netease' || song.neteaseId || neteaseId.match(/^\d+$/)) {
    removeNeteaseFrame();
    createNeteaseFrame(neteaseId);
    // 同时用audio做兜底
    audioElement.src = `/api/music/play/${song.id}`;
    audioElement.volume = volume.value / 100;
    audioElement.play().catch(() => {});
    return;
  }

  // 本地歌曲 → 直接用audio
  removeNeteaseFrame();
  audioElement.src = `/api/music/play/${song.id}`;
  audioElement.volume = volume.value / 100;
  audioElement.play().catch(() => {
    isPlaying.value = false;
  });
}

export function pause() {
  removeNeteaseFrame();
  audioElement?.pause();
  isPlaying.value = false;
}

export async function resume() {
  try { await audioElement?.play(); isPlaying.value = true; } catch {}
}

export function next() {
  const q = queue.value;
  if (q.length === 0) return;
  if (playMode.value === 'shuffle') {
    let r; do { r = Math.floor(Math.random() * q.length); } while (q.length > 1 && r === queueIndex.value);
    play(q[r]);
  } else {
    const idx = queueIndex.value;
    if (idx < q.length - 1) play(q[idx + 1]);
    else if (q.length > 0) play(q[0]); // 最后一首下一首 → 从头
  }
}

export function prev() {
  const q = queue.value;
  if (q.length === 0) return;
  if (playMode.value === 'shuffle') {
    let r; do { r = Math.floor(Math.random() * q.length); } while (q.length > 1 && r === queueIndex.value);
    play(q[r]);
  } else {
    const idx = queueIndex.value;
    if (idx > 0) play(q[idx - 1]);
  }
}

export function getCurrentTime() {
  return audioElement?.currentTime || 0;
}

export function setVolume(val) {
  volume.value = val;
  if (audioElement) audioElement.volume = val / 100;
}

export function seek(percent) {
  if (!audioElement) return;
  const dur = audioElement.duration;
  // 代理流可能没有duration，用歌曲元数据兜底
  if (dur && isFinite(dur) && dur > 0) {
    audioElement.currentTime = (percent / 100) * dur;
  } else if (currentSong.value?.duration) {
    audioElement.currentTime = (percent / 100) * currentSong.value.duration;
  }
}

function handleSongEnd() {
  const mode = playMode.value;
  const q = queue.value;
  if (mode === 'loop') { audioElement.currentTime = 0; audioElement.play().catch(()=>{}); }
  else if (mode === 'sequence') {
    if (queueIndex.value < q.length - 1) next();
    else if (q.length > 0) play(q[0]); // 最后一首 → 从头循环
  }
  else if (mode === 'shuffle') play(q[Math.floor(Math.random() * q.length)]);
  else isPlaying.value = false;
}

export function initVisualizer(canvas) {
  // 网易云播放器不支持可视化，用canvas画个简单动画
  let animId;
  const ctx = canvas.getContext('2d');
  function draw() {
    animId = requestAnimationFrame(draw);
    ctx.fillStyle = 'rgba(255,240,245,0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const t = Date.now() / 200;
    for (let i = 0; i < 32; i++) {
      const h = Math.sin(t + i * 0.3) * 20 + 25;
      ctx.fillStyle = `rgba(236,72,153, 0.7)`;
      ctx.fillRect(i * 10, canvas.height - h, 8, h);
    }
  }
  draw();
}

