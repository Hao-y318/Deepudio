// Deepudio Radio 启动器

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const URL = `http://localhost:${PORT}`;

main().catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});

async function main() {
  console.log('Deepudio Radio 启动中...\n');

  // 0. 杀掉旧进程（确保最新代码运行）
  await killOldServer();

  // 1. 构建前端（始终重建，确保改动生效）
  console.log('[1/3] 构建前端...');
  await run('npm', ['run', 'build', '--workspace=client'], { cwd: __dirname });

  // 2. 启动后端
  console.log('[2/3] 启动服务...');
  const server = spawn('node', ['server/index.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('listening') || s.includes('running') || s.includes('Found liked')) {
      console.log(' ', s.trim());
    }
  });
  server.stderr.on('data', d => console.error(' ', d.toString().trim()));

  // 3. 等待就绪
  await waitForServer();

  // 4. 打开窗口
  console.log('[3/3] 打开应用...\n');
  openAppWindow();

  console.log('  Deepudio Radio 已启动!');
  console.log('  关闭此窗口可停止服务\n');

  process.stdin.resume();
  process.on('SIGINT', () => { server.kill(); process.exit(0); });
  process.on('SIGTERM', () => { server.kill(); process.exit(0); });
}

async function killOldServer() {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      exec('powershell -Command "8080,3000 | ForEach-Object { $p=$_; Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"', () => {
        setTimeout(resolve, 1500);
      });
    } else {
      exec('lsof -ti:8080 -ti:3000 | xargs kill -9 2>/dev/null', () => {
        setTimeout(resolve, 1000);
      });
    }
  });
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, shell: true, stdio: 'inherit' });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)));
    p.on('error', reject);
  });
}

function waitForServer(maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      tries++;
      const req = http.get(`${URL}/api/health`, res => {
        if (res.statusCode === 200) { res.resume(); resolve(); }
        else if (tries < maxRetries) { setTimeout(check, 1000); }
        else { reject(new Error('Server not healthy')); }
      });
      req.on('error', () => {
        if (tries < maxRetries) { setTimeout(check, 1000); }
        else { reject(new Error('Server unreachable')); }
      });
      req.setTimeout(2000, () => { req.destroy(); if (tries < maxRetries) setTimeout(check, 1000); });
    };
    check();
  });
}

function openAppWindow() {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      const edgePaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ];
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
      ];

      let found = false;
      for (const p of edgePaths) {
        if (fs.existsSync(p)) {
          spawn(p, [`--app=${URL}`, '--window-size=1200,800'], { detached: true, stdio: 'ignore' }).unref();
          found = true; break;
        }
      }
      if (!found) {
        for (const p of chromePaths) {
          if (fs.existsSync(p)) {
            spawn(p, [`--app=${URL}`, '--window-size=1200,800'], { detached: true, stdio: 'ignore' }).unref();
            found = true; break;
          }
        }
      }
      if (!found) {
        spawn('cmd', ['/c', 'start', URL], { detached: true, stdio: 'ignore', shell: true }).unref();
      }
      setTimeout(resolve, 1000);
    } else {
      exec('open ' + URL + ' 2>/dev/null || xdg-open ' + URL + ' 2>/dev/null', () => resolve());
    }
  });
}
