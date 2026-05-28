import { prepare } from './userStore.js';

export function recordPlay(song, action = 'complete', source = 'recommend') {
  prepare(`
    INSERT INTO play_history (song_id, title, artist, album, duration_played, total_duration, action, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(song.id, song.title, song.artist, song.album || null, song.durationPlayed || 0, song.duration || 0, action, source);
}

export function getRecentPlays(range = '7d') {
  let days = 7;
  if (range === '30d') days = 30;
  else if (range === 'all') days = 3650;

  return prepare(`
    SELECT song_id, title, artist, album, played_at, action
    FROM play_history
    WHERE played_at >= datetime('now', '-${days} days')
    ORDER BY played_at DESC
    LIMIT 200
  `).all();
}

export function getTopArtists(days = 30, limit = 10) {
  return prepare(`
    SELECT artist, COUNT(*) as play_count
    FROM play_history
    WHERE played_at >= datetime('now', '-${days} days') AND action != 'skip'
    GROUP BY artist
    ORDER BY play_count DESC
    LIMIT ?
  `).all(limit);
}

export function getTopGenres(days = 30, limit = 5) {
  return prepare(`
    SELECT tag_value, weight FROM user_tags
    WHERE tag_type = 'genre'
    ORDER BY weight DESC LIMIT ?
  `).all(limit);
}
