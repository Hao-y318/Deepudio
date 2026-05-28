import { prepare } from './userStore.js';

export function getUserTags() {
  return prepare('SELECT * FROM user_tags ORDER BY weight DESC').all();
}

export function getTagsByType(tagType) {
  return prepare('SELECT * FROM user_tags WHERE tag_type = ? ORDER BY weight DESC').all(tagType);
}

export function upsertTag(tagType, tagValue, weight, source = 'auto') {
  prepare(`
    INSERT INTO user_tags (tag_type, tag_value, weight, source)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tag_type, tag_value)
    DO UPDATE SET weight = ?, source = ?, updated_at = CURRENT_TIMESTAMP
  `).run(tagType, tagValue, weight, source, weight, source);
}

export function updateTagWeight(tagType, tagValue, delta) {
  const existing = prepare(
    'SELECT weight FROM user_tags WHERE tag_type = ? AND tag_value = ?'
  ).get(tagType, tagValue);

  if (existing) {
    const newWeight = Math.max(0, Math.min(1, existing.weight + delta));
    upsertTag(tagType, tagValue, newWeight, 'auto');
  } else if (delta > 0) {
    upsertTag(tagType, tagValue, Math.min(1, delta), 'auto');
  }
}

export function getProfile() {
  const genres = getTagsByType('genre');
  const moods = getTagsByType('mood');
  const scenes = getTagsByType('scene');
  const artists = getTagsByType('artist');

  return {
    tasteProfile: {
      genres: Object.fromEntries(genres.map(g => [g.tag_value, g.weight])),
      moodPreference: Object.fromEntries(moods.map(m => [m.tag_value, m.weight])),
      scenePreference: Object.fromEntries(scenes.map(s => [s.tag_value, s.weight])),
      topArtists: artists.map(a => ({ name: a.tag_value, weight: a.weight }))
    },
    lastUpdated: new Date().toISOString()
  };
}
