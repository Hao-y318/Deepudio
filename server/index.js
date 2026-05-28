// Deepudio Radio 服务入口

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { loadConfig, DATA_DIR } from './config.js';
import { initDB } from './store/userStore.js';
import { registerWebSocket, broadcastToAll } from './ws/handler.js';
import { setEventHandler, startScheduler } from './modules/scheduler.js';
import { startWeatherPolling } from './services/weather.js';
import { spawn } from 'child_process';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));

function startNCMProxy() {
  // 先检查端口3000是否已被旧进程占用（直接用现有的）
  return new Promise(resolve => {
    const test = spawn('node', ['-e', "require('net').createServer().listen(3000).on('listening',function(){process.exit(0)}).on('error',function(){process.exit(1)})"], {
      stdio: 'pipe', shell: true
    });
    test.on('close', code => {
      if (code === 1) {
        // 端口已被占用，直接用现有代理
        console.log('  NCM proxy already running on port 3000, reusing');
        import('./services/netease.js').then(m => { m.setProxyAvailable(true); resolve(); }).catch(() => resolve());
        return;
      }
      // 端口空闲，启动新代理
      const child = spawn('node', [path.join(__dir, 'ncm-server.mjs')], {
        cwd: path.join(__dir, '..'), stdio: 'pipe', shell: true
      });
      child.stdout.on('data', d => {
        const s = d.toString().trim();
        if (s) console.log(' ', s);
        if (s.includes('running')) {
          import('./services/netease.js').then(m => m.setProxyAvailable(true)).catch(() => {});
          resolve();
        }
      });
      child.stderr.on('data', d => console.error(' ', d.toString().trim()));
      setTimeout(resolve, 3000); // fallback timeout
    });
  });
}

import chatRoutes from './routes/chat.js';
import musicRoutes from './routes/music.js';
import weatherRoutes from './routes/weather.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function start() {
  const config = loadConfig();

  // 初始化数据库
  await initDB();
  console.log('Database initialized');

  // 启动网易云解锁代理（VIP歌曲自动找替代音源）
  await startNCMProxy(3000);

  // 创建 Fastify 实例
  const fastify = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  // 注册插件
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  // 注册路由
  fastify.register(chatRoutes);
  fastify.register(musicRoutes);
  fastify.register(weatherRoutes);
  fastify.register(profileRoutes);
  fastify.register(settingsRoutes);

  // 注册 WebSocket
  registerWebSocket(fastify);

  // 健康检查
  fastify.get('/api/health', async () => ({ status: 'ok', time: Date.now() }));

  // 静态文件（生产环境：前端构建产物）
  const clientDist = join(__dirname, '..', 'client', 'dist');
  try {
    await fastify.register(staticPlugin, {
      root: clientDist,
      prefix: '/',
      maxAge: 0,
      cacheControl: false
    });
  } catch {
    console.log('Client dist not found, running in dev mode');
  }

  // 设置调度器事件推送
  setEventHandler((event) => {
    broadcastToAll(event);
  });

  // 启动服务
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    console.log(`Deepudio Radio running on http://localhost:${config.server.port}`);

    // 启动后台服务
    startScheduler();
    startWeatherPolling();
    console.log('Scheduler and weather polling started');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
