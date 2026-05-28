// 设置管理 API 路由

import { loadConfig, updateConfig, saveConfig } from '../config.js';
import { stopScheduler, startScheduler } from '../modules/scheduler.js';
import { stopWeatherPolling, startWeatherPolling } from '../services/weather.js';
import { clearLikedCache } from '../services/netease.js';
import { recommendedHistory } from '../modules/musicEngine.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/api/settings', async () => {
    const config = loadConfig();
    return {
      server: config.server,
      ai: {
        ...config.ai,
        apiKey: config.ai.apiKey ? '******' : ''
      },
      localMusic: config.localMusic,
      netease: {
        ...config.netease,
        cookie: config.netease.cookie ? '******' : ''
      },
      weather: {
        ...config.weather,
        apiKey: config.weather.apiKey ? '******' : ''
      },
      tts: config.tts,
      scheduler: config.scheduler,
      upnp: config.upnp
    };
  });

  fastify.put('/api/settings', async (request) => {
    const partial = request.body;

    // 脱敏值或空字符串 = 不更新（保留原有值）
    if (partial.ai && (!partial.ai.apiKey || partial.ai.apiKey === '******')) delete partial.ai.apiKey;
    if (partial.netease && (!partial.netease.cookie || partial.netease.cookie === '******')) delete partial.netease.cookie;
    if (partial.weather && (!partial.weather.apiKey || partial.weather.apiKey === '******')) delete partial.weather.apiKey;

    const updated = updateConfig(partial);

    // 网易云配置变化时清除缓存和推荐历史
    if (partial.netease) {
      clearLikedCache();
      const before = recommendedHistory.size;
      recommendedHistory.clear();
      console.log(`[settings] Cleared recommendation history (was ${before} songs)`);
    }

    // 调度配置变化时重启
    if (partial.scheduler) {
      stopScheduler();
      startScheduler();
    }

    // 天气配置变化时重启轮询
    if (partial.weather) {
      stopWeatherPolling();
      startWeatherPolling();
    }

    return { success: true };
  });
}
