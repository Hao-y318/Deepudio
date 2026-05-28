import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
// PWA 插件已禁用：应用通过 Electron/--app 窗口运行，无需 Service Worker
// import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    // VitePWA({ ... })  // 已禁用，避免 SW 缓存导致更新不可见
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true }
    }
  }
});
