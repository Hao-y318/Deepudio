// 个人画像弹窗

import { useState, useEffect } from 'preact/hooks';
import { api } from '../../services/api.js';

export function ProfileDialog({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [p, h] = await Promise.all([
        api.getProfile(),
        api.getHistory('7d')
      ]);
      setProfile(p);
      setHistory(h.plays || []);
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="profile-overlay" onClick={onClose}>
      <div class="profile-dialog" onClick={e => e.stopPropagation()}>
        <h2>
          👤 我的音乐画像
          <button class="settings-close" onClick={onClose}>✕</button>
        </h2>

        {loading ? (
          <p>加载中...</p>
        ) : (
          <>
            {/* 风格偏好 */}
            <div class="taste-section">
              <h3>风格偏好</h3>
              <div class="taste-tags">
                {profile?.tasteProfile?.genres && Object.entries(profile.tasteProfile.genres).map(([genre, weight]) => (
                  <span key={genre} class="taste-tag" style={{ opacity: Math.max(0.5, weight) }}>
                    {genre}
                  </span>
                ))}
                {(!profile?.tasteProfile?.genres || Object.keys(profile.tasteProfile.genres).length === 0) && (
                  <p class="empty-hint">还没有偏好数据，多听几首歌就会有了</p>
                )}
              </div>
            </div>

            {/* 心情偏好 */}
            <div class="taste-section">
              <h3>心情偏好</h3>
              <div class="taste-tags">
                {profile?.tasteProfile?.moodPreference && Object.entries(profile.tasteProfile.moodPreference).map(([mood, weight]) => (
                  <span key={mood} class="taste-tag" style={{ opacity: Math.max(0.5, weight) }}>
                    {mood === 'relaxed' ? '放松' : mood === 'energetic' ? '活力' : mood === 'melancholy' ? '忧郁' : mood}
                  </span>
                ))}
              </div>
            </div>

            {/* 最爱艺人 */}
            <div class="taste-section">
              <h3>最爱艺人</h3>
              <div class="artist-list">
                {profile?.tasteProfile?.topArtists?.map(a => (
                  <div key={a.name} class="artist-item">
                    <span class="artist-name">{a.name}</span>
                    <div class="artist-bar" style={{ width: `${a.weight * 100}%` }} />
                  </div>
                ))}
                {(!profile?.tasteProfile?.topArtists || profile.tasteProfile.topArtists.length === 0) && (
                  <p class="empty-hint">暂无数据</p>
                )}
              </div>
            </div>

            {/* 最近播放 */}
            <div class="taste-section">
              <h3>最近播放</h3>
              {history.slice(0, 15).map(song => (
                <div key={song.id + song.played_at} class="history-item">
                  <span class="history-title">{song.title}</span>
                  <span class="history-artist">{song.artist}</span>
                </div>
              ))}
              {history.length === 0 && <p class="empty-hint">暂无播放记录</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
