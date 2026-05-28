// 歌单选择器 - 可视化浏览和切换歌单

import { useState, useEffect } from 'preact/hooks';
import { api } from '../../services/api.js';
import { currentSong } from '../../app/store.js';

export function PlaylistPicker({ show, onClose, onSelect }) {
  const [playlists, setPlaylists] = useState([]);
  const [activeIds, setActiveIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (show) loadPlaylists();
  }, [show]);

  async function loadPlaylists() {
    try {
      const data = await api.getNetEasePlaylists();
      const pls = data.playlists || [];
      setPlaylists(pls);

      // 获取当前已选的歌单
      const settings = await api.getSettings();
      const extra = settings.netease?.extraPlaylistIds || [];
      const liked = settings.netease?.likedPlaylistId || '';
      const all = new Set(extra);
      if (liked) all.add(liked);
      setActiveIds([...all]);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function togglePlaylist(id) {
    setActiveIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  }

  async function saveAndClose() {
    const likedId = playlists.find(p => p.isLiked)?.id || '';
    const extra = activeIds.filter(id => id !== likedId);

    await api.updateSettings({
      netease: { likedPlaylistId: likedId, extraPlaylistIds: extra }
    });
    if (onSelect) onSelect(activeIds);
    onClose();
  }

  if (!show) return null;

  return (
    <div class="playlist-overlay" onClick={onClose}>
      <div class="playlist-dialog" onClick={e => e.stopPropagation()}>
        <div class="playlist-dialog-header">
          <h3>我的歌单</h3>
          <button class="playlist-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p class="playlist-loading">加载中...</p>
        ) : (
          <div class="playlist-grid">
            {playlists.map(pl => {
              const active = activeIds.includes(String(pl.id));
              return (
                <div
                  key={pl.id}
                  class={`playlist-card ${active ? 'active' : ''}`}
                  onClick={() => togglePlaylist(String(pl.id))}
                >
                  <div class="playlist-card-cover">
                    {pl.coverUrl ? <img src={pl.coverUrl} alt="" /> : <span>🎵</span>}
                    <div class="playlist-card-badge">{pl.trackCount}首</div>
                  </div>
                  <div class="playlist-card-info">
                    <div class="playlist-card-name">
                      {pl.isLiked && '❤️ '}{pl.name}
                    </div>
                  </div>
                  {active && <div class="playlist-check">✓</div>}
                </div>
              );
            })}
          </div>
        )}

        <div class="playlist-actions">
          <span class="playlist-hint">已选 {activeIds.length} 个歌单</span>
          <button class="save-btn" onClick={saveAndClose}>确认切换</button>
        </div>
      </div>
    </div>
  );
}
