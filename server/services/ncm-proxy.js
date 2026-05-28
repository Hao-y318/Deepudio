// 启动 @unblockneteasemusic 代理服务器
// 拦截网易云API请求，VIP/无版权歌曲自动从酷狗/咪咕/酷我找替代音源

import { createApp } from '@unblockneteasemusic/server';

let proxyServer = null;

export async function startNCMProxy(port = 3000) {
  if (proxyServer) return proxyServer;

  try {
    const app = createApp({
      port,
      host: '127.0.0.1',
      // 启用本地VIP欺骗
      env: {
        ENABLE_LOCAL_VIP: 'true',
        ENABLE_FLAC: 'true',
        MIN_BR: '128000'
      }
    });

    await app.start();
    proxyServer = app;
    // 通知netease服务启用代理
    const { setProxyAvailable } = await import('./netease.js');
    setProxyAvailable(true);
    console.log(`NCM proxy running on http://127.0.0.1:${port}`);
    console.log('  VIP spoof: ON | FLAC: ON | Fallback: kugou, migu, kuwo');
    return proxyServer;
  } catch (err) {
    console.error('Failed to start NCM proxy:', err.message);
    console.log('  Falling back to direct NetEase API');
    return null;
  }
}

export async function stopNCMProxy() {
  if (proxyServer) {
    try { await proxyServer.close(); } catch {}
    proxyServer = null;
  }
}
