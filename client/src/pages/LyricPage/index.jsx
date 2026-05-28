// 歌词面板 - 当前播放歌曲的实时歌词

import { useSignal, effect } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { currentSong, isPlaying } from '../../app/store.js';
import { api } from '../../services/api.js';
import { getCurrentTime } from '../../services/audioEngine.js';

export function LyricPanel() {
  const [lyrics, setLyrics] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const containerRef = useRef(null);

  // 歌曲切换时加载歌词
  useEffect(() => {
    const song = currentSong.value;
    if (!song || !song.neteaseId) {
      setLyrics([]);
      return;
    }
    loadLyrics(song.id);
  }, [currentSong.value?.id]);

  async function loadLyrics(songId) {
    try {
      const data = await api.getLyrics(songId);
      const lrcText = data.lyrics || data.lrc?.lyric || '';
      const parsed = parseLRC(lrcText);
      setLyrics(parsed);
      setCurrentIndex(-1);
    } catch {
      setLyrics([]);
    }
  }

  // LRC 解析
  function parseLRC(lrc) {
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    const lrcLines = lrc.split('\n');

    for (const line of lrcLines) {
      const match = line.match(regex);
      if (!match) continue;
      const text = line.replace(regex, '').trim();
      if (!text) continue;

      for (const m of match) {
        const parts = m.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/);
        if (!parts) continue;
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        const ms = parts[3] ? parseInt(parts[3].padEnd(3, '0')) : 0;
        const time = minutes * 60 + seconds + ms / 1000;
        lines.push({ time, text });
      }
    }

    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  // 实时高亮当前行
  useEffect(() => {
    if (lyrics.length === 0) return;
    const interval = setInterval(() => {
      const currentTime = getCurrentTime();
      if (currentTime <= 0) { setCurrentIndex(-1); return; }

      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) idx = i;
        else break;
      }
      setCurrentIndex(idx);
    }, 200);

    return () => clearInterval(interval);
  }, [lyrics]);

  // 自动滚动
  useEffect(() => {
    if (currentIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector('.lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentIndex]);

  const song = currentSong.value;
  const playing = isPlaying.value;

  return (
    <div class="lyric-panel">
      <div class="lyric-header">
        <span class="lyric-title">歌词</span>
        {song && <span class="lyric-song-name">{song.title}</span>}
      </div>

      <div class="lyric-body" ref={containerRef}>
        {lyrics.length === 0 && (
          <div class="lyric-empty">
            {song ? '暂无歌词' : '选择一首歌开始播放'}
          </div>
        )}
        {lyrics.map((line, i) => (
          <div
            key={i}
            class={`lyric-line ${i === currentIndex ? 'active' : ''} ${i < currentIndex ? 'past' : ''}`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
