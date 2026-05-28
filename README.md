# Deepudio Radio

AI 智能点歌电台 —— 像私人 DJ 一样懂你的听歌品味。

## 功能

- **AI 自然语言点歌** — 告诉它你的心情，它会帮你选歌
- **天气联动推荐** — 雨天自动放慵懒爵士，晴天切轻快流行
- **网易云音乐集成** — 绑定账号，读取歌单、搜索歌曲
- **智能播报** — TTS 语音播报天气、歌曲信息，DJ 模式
- **定时任务** — 早安问候、自动续播、天气提醒
- **PWA + Electron** — 手机电脑都能用，也可打包桌面端

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Fastify + WebSocket |
| 前端 | React + Vite |
| AI | DeepSeek |
| 存储 | SQLite (better-sqlite3) |
| 桌面 | Electron |
| 音乐源 | 网易云音乐 (NCM 解锁代理) |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（前后端同时启动）
npm run dev

# 仅启动后端
npm run server

# 生产模式（先构建前端再启动）
npm start
```

访问 `http://localhost:8080`

## 配置

首次启动后在 Web 界面 `设置` 页面配置：

- AI API Key（DeepSeek）
- 网易云 Cookie（可选，用于读取歌单）
- 天气 API Key（可选，OpenWeatherMap）

配置保存在本地 `data/` 目录，不会上传。

## 项目结构

```
audio/
├── client/          # React 前端
│   ├── src/
│   │   ├── pages/   # 页面组件（播放器/歌词/聊天/设置）
│   │   ├── components/ # 通用组件
│   │   └── services/   # API / WebSocket / 音频引擎
│   └── dist/        # 构建产物
├── server/          # Fastify 后端
│   ├── routes/      # HTTP 路由
│   ├── modules/     # AI 适配器 / 音乐引擎 / 调度器
│   ├── services/    # 天气 / 网易云 / UPnP
│   ├── store/       # SQLite 存储
│   └── ws/          # WebSocket 处理
├── electron/        # Electron 桌面端入口
├── data/            # 本地数据（gitignore）
└── launch.mjs       # 生产启动脚本
```

## License

MIT
