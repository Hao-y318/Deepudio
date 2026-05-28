// 左侧电台播放器面板

import { useSignal } from '@preact/signals';
import { useState, useRef, useEffect } from 'preact/hooks';
import { currentSong, isPlaying, progress, volume, playMode, queue, queueIndex, addToQueue } from '../../app/store.js';
import { play, pause, resume, next, prev, setVolume, seek } from '../../services/audioEngine.js';
import { SpectrumBars } from '../../components/Player/SpectrumBars.jsx';

export function PlayerPanel() {
  const showQueue = useSignal(true);
  const song = currentSong.value;
  const modeIcons = { sequence: '🔁', loop: '🔂', shuffle: '🔀' };

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  async function doSearch(q) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      // 先搜我喜欢歌单
      const r1 = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=10`);
      const d1 = await r1.json();
      setSearchResults(d1.songs || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  function handleSearchInput(e) {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 300);
  }

  return (
    <div class="player-page">
      <div class="player-header-sticky">
      {/* 搜索框 */}
      <div class="player-search">
        <input
          class="player-search-input"
          type="text"
          placeholder="搜索歌曲..."
          value={searchQuery}
          onInput={handleSearchInput}
        />
        {searchResults.length > 0 && (
          <div class="player-search-results">
            {searchResults.map(s => (
              <div key={s.id} class="search-result-item">
                <span class="search-result-title">{s.title}</span>
                <span class="search-result-artist">{s.artist}</span>
                <button class="search-result-btn" onClick={() => { addToQueue(s); play(s); setSearchQuery(''); setSearchResults([]); }}
                  title="立即播放">▶</button>
                <button class="search-result-btn" onClick={() => { addToQueue(s); setSearchQuery(''); setSearchResults([]); }}
                  title="加入队列">+</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 旋转唱片 */}
      <div class="player-cover-area">
        <div class={`cover-disc ${isPlaying.value ? 'spinning' : 'paused'}`}>
          <div class="cover-disc-grooves" />
          <div class="cover-disc-image">
            {song?.coverUrl ? (
              <img src={song.coverUrl} alt={song.title} />
            ) : (
              <div class="cover-placeholder">📻</div>
            )}
          </div>
          <div class="cover-disc-center" />
        </div>
        <div class="cover-glow" />
      </div>

      {/* 歌曲信息 */}
      <div class="player-info">
        <h2 class="player-title">{song?.title || 'Deepudio Radio'}</h2>
        <p class="player-artist">{song?.artist || '等待你的指令...'}</p>
        {song?.neteaseId && (
          <a class="netease-link" href={`https://music.163.com/#/song?id=${String(song.neteaseId).replace('netease_','')}`}
             target="_blank" title="在网易云音乐中打开（解决无法播放问题）">
            在网易云打开 ↗
          </a>
        )}
      </div>

      {/* 进度条 */}
      <div class="player-progress" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        seek(pct);
      }}>
        <div class="progress-bar" style={{ width: `${progress.value}%` }} />
      </div>

      {/* 频谱可视化 */}
      <div class="spectrum-wrap">
        <SpectrumBars />
      </div>

      {/* 控制按钮 */}
      <div class="player-controls">
        <button class="ctrl-btn" onClick={() => {
          const modes = ['sequence', 'loop', 'shuffle'];
          const idx = modes.indexOf(playMode.value);
          playMode.value = modes[(idx + 1) % 3];
        }}>
          {modeIcons[playMode.value]}
        </button>
        <button class="ctrl-btn" onClick={prev}>⏮</button>
        <button class="ctrl-btn play-btn" onClick={() => isPlaying.value ? pause() : (song ? resume() : null)}>
          {isPlaying.value ? '⏸' : '▶'}
        </button>
        <button class="ctrl-btn" onClick={next}>⏭</button>
        <button class="ctrl-btn" onClick={() => showQueue.value = !showQueue.value}>📋</button>
      </div>

      {/* 音量 */}
      <div class="player-volume">
        <span>🔈</span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume.value}
          onInput={(e) => setVolume(Number(e.target.value))}
        />
        <span>🔊</span>
      </div>

      </div>

      {/* 播放队列 */}
      {showQueue.value && <QueueList />}
    </div>
  );
}

function QueueList() {
  const list = queue.value;
  const idx = queueIndex.value;

  return (
    <div class="queue-section">
      <div class="queue-header">
        <h3>播放队列 ({list.length})</h3>
      </div>
      {list.length === 0 ? (
        <p class="queue-empty">在右侧聊天让DJ推荐歌曲吧~</p>
      ) : (
        list.map((song, i) => (
          <div
            key={song.id}
            class={`queue-item ${i === idx ? 'active' : ''}`}
            onClick={() => play(song)}
          >
            <span class="queue-num">{i + 1}</span>
            <span class="queue-title">{song.title}</span>
            <span class="queue-artist">{song.artist}</span>
          </div>
        ))
      )}
    </div>
  );
}
