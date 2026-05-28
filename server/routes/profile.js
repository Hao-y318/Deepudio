// 用户画像 API 路由

import { getProfile, upsertTag } from '../store/preferenceStore.js';
import { getRecentPlays, getTopArtists } from '../store/historyStore.js';

export default async function profileRoutes(fastify) {
  fastify.get('/api/profile', async () => {
    return getProfile();
  });

  fastify.get('/api/profile/history', async (request) => {
    const range = request.query.range || '7d';
    return { plays: getRecentPlays(range) };
  });

  fastify.get('/api/profile/top-artists', async (request) => {
    const days = parseInt(request.query.days) || 30;
    const limit = parseInt(request.query.limit) || 10;
    return { artists: getTopArtists(days, limit) };
  });

  fastify.put('/api/profile/tags', async (request) => {
    const { tagType, tagValue, weight, source } = request.body;
    upsertTag(tagType, tagValue, weight, source || 'manual');
    return { success: true };
  });
}
