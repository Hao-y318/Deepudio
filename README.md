# Deepudio Radio

AI 智能点歌电台 —— 像私人 DJ 一样懂你的听歌品味。

## 功能

- **AI 自然语言点歌** — 告诉它你的心情，它会帮你选歌
- **天气联动推荐** — 雨天自动放慵懒爵士，晴天切轻快流行
- **网易云音乐集成** — 绑定账号，读取歌单、搜索歌曲
- **智能播报** — AI 生成早安问候、天气变化提醒，TTS 语音播报
- **定时任务** — 每日 AI 早安推荐、静默互动提醒、天气联动播报
- **PWA + Electron** — 手机电脑都能用，也可打包桌面端

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Fastify + WebSocket |
| 前端 | React + Vite |
| AI | DeepSeek |
| 存储 | SQLite (sql.js WASM) |
| 桌面 | Electron |
| 音乐源 | 网易云音乐 (NCM 解锁代理) |

## 快速开始

```bash
git clone https://github.com/Hao-y318/Deepudio.git
cd Deepudio
npm install
npm start
```

访问 `http://localhost:8080`，首次启动自动创建 `data/` 目录。

## 配置

在 Web 界面 `设置` 页面配置：

- **AI API Key**（DeepSeek，必填）
- 网易云 Cookie（可选，读取歌单）
- 天气 API Key（可选，OpenWeatherMap，用于 AI 天气播报）

配置保存在本地 `data/` 目录，不上传 Git。

## 项目结构

```
audio/
├── client/          # React 前端
│   ├── src/
│   │   ├── pages/   # 页面（播放器/歌词/聊天/设置）
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
├── data/            # 本地数据（gitignore，自动创建）
└── launch.mjs       # 生产启动脚本
```

## License

MIT
