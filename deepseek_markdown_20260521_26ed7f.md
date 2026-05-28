# AI智能点歌电台 —— 完整技术设计文档

> **项目代号**：Deepudio-Radio
> **设计理念**：读懂你的听歌习惯与即时状态 → 结合天气与日程规划声音 → 像私人DJ那样智能播报与点歌
> **参照架构**：Deepudio 施工图（本地大脑 + 外部API + PWA播放器）

---

## 1. 项目概述

### 1.1 核心功能
- **AI智能聊天**：自然语言对话，理解用户情绪、活动状态、偏好
- **状态感知推荐**：根据用户当前状态（工作/放松/运动/通勤等）智能推荐歌曲
- **天气联动推荐**：自动获取本地天气，推荐匹配天气氛围的音乐（雨天/晴天/雪天/大风等）
- **网易云音乐集成**：绑定用户网易云账号，读取歌单、搜索歌曲、获取推荐
- **喜好自动学习**：通过播放历史、点赞/跳过、对话反馈，持续更新用户品味模型
- **家庭音响推流**：支持UPnP/DLNA推送到客厅音响（可选扩展）

### 1.2 技术目标
- 纯本地可运行（也可部署到服务器）
- 全平台PWA（手机/电脑均可使用）
- 完全开源，数据自主可控

---

## 2. 系统架构图（文字版）

```text
┌─────────────────────────────────────────────────────────────────┐
│                        前端 PWA (localhost:8080)                 │
│  播放器界面 | 聊天窗口 | 个人资料页 | 设置页 | Service Worker      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                       Node.js 后端（中枢服务器）                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Router_JS  │  │  Context_JS  │  │  Claude_JS   │           │
│  │   意图分流    │  │  提示词组装   │  │  大脑适配器   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Scheduler_JS │  │   TTS_JS     │  │   State_OB   │           │
│  │  节律调度     │  │ 声音管线(选) │  │  状态记忆     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───┬──────────────┬───────────────┬──────────────────────────────┘
    │              │               │
    ▼              ▼               ▼
┌─────────┐  ┌──────────┐  ┌─────────────┐
│网易云API│  │天气API   │  │ Claude API  │
│(音乐库) │  │(OpenWeather)│ │ (AI大脑)    │
└─────────┘  └──────────┘  └─────────────┘
```

---

## 3. 前端 PWA 详细设计

### 3.1 整体结构

```text
src/
├── app/                    # PWA 入口与路由
│   ├── main.js             # 应用入口，注册 Service Worker
│   ├── router.js           # 前端路由定义
│   └── store.js            # 全局状态管理（轻量状态树）
├── pages/
│   ├── PlayerPage/         # 主播放器页面
│   ├── ChatPage/           # 聊天对话页面
│   ├── ProfilePage/        # 用户画像与偏好页面
│   └── SettingsPage/       # 系统设置页面
├── components/
│   ├── Player/             # 播放器相关组件
│   ├── Chat/               # 聊天相关组件
│   ├── Weather/            # 天气展示组件
│   └── Common/             # 通用组件（按钮、卡片等）
├── services/
│   ├── api.js              # 后端 API 通信封装
│   ├── websocket.js        # WebSocket 连接管理
│   └── audioEngine.js      # 音频播放引擎
├── workers/
│   └── sw.js               # Service Worker（缓存 & 离线）
└── styles/
    └── theme.css           # 全局主题变量
```

### 3.2 播放器模块 (Player)

**职责**：音频播放控制、播放队列管理、歌词展示

| 组件 | 功能 |
|------|------|
| `NowPlaying` | 当前播放歌曲封面、标题、艺人、进度条 |
| `PlayControls` | 播放/暂停、上一首/下一首、随机/循环模式 |
| `QueueList` | 待播队列展示，支持拖拽排序和移除 |
| `LyricsView` | 实时逐行滚动歌词（LRC解析） |

**音频引擎 `audioEngine.js`**：
- 基于 Web Audio API 构建
- 支持音频源：网易云直链（需后端代理）、本地文件、HTTP流
- 音频可视化：频谱分析器（AnalyserNode）→ Canvas 渲染
- 淡入淡出切换（crossfade），间隔 2s
- 音量记忆与均衡器预设（可选）

**播放队列数据结构**：
```json
{
  "queue": [
    {
      "id": "netease_12345",
      "source": "netease",
      "title": "晴天",
      "artist": "周杰伦",
      "album": "叶惠美",
      "duration": 269,
      "coverUrl": "https://...",
      "audioUrl": "https://...",
      "lrcUrl": "https://..."
    }
  ],
  "currentIndex": 0,
  "mode": "sequence",
  "history": []
}
```

### 3.3 聊天模块 (Chat)

**职责**：与 AI DJ 自然语言交互

| 组件 | 功能 |
|------|------|
| `ChatWindow` | 对话气泡列表，区分用户/AI消息 |
| `ChatInput` | 文字输入框 + 语音输入按钮 |
| `QuickActions` | 快捷指令按钮（"来点轻音乐"、"下一首"、"今天天气"） |
| `NowPlayingBar` | 聊天页底部迷你播放条，不离开聊天页即可控制播放 |

**交互流程**：
1. 用户输入 → WebSocket 发送到后端 Router
2. Router 分流后，Claude 生成回复 + 推荐歌曲
3. 回复通过 WebSocket 推送到前端
4. 推荐歌曲自动加入播放队列并提示用户
5. 用户可语音输入（Web Speech API → 文本 → 同上流程）

**消息数据结构**：
```json
{
  "id": "msg_001",
  "role": "user" | "assistant",
  "content": "我想听点轻松的音乐",
  "timestamp": 1716268800000,
  "metadata": {
    "intent": "music_request",
    "songs": ["netease_12345"],
    "weather": "rainy",
    "mood": "relaxed"
  }
}
```

### 3.4 个人资料页 (Profile)

**职责**：展示和编辑用户音乐画像

| 区域 | 展示内容 |
|------|----------|
| 品味雷达图 | 六维标签：流行/摇滚/电子/民谣/古典/嘻哈 |
| Top 歌手/歌曲 | 近7天/30天/全部时间的播放排行 |
| 偏好标签云 | 用户手动添加 + 系统自动学习的标签 |
| 听歌日历 | 热力图展示每日听歌时长 |
| 歌单同步 | 网易云歌单导入状态 |

### 3.5 设置页 (Settings)

| 设置项 | 说明 |
|--------|------|
| 网易云账号绑定 | 扫码/cookie 登录 |
| 所在城市 | 用于天气联动（支持自动定位） |
| Claude API Key | 填入自己的 API Key |
| TTS 语音选择 | 系统TTS / 第三方TTS / 关闭 |
| 音频输出设备 | 选择播放设备，含 UPnP 设备发现 |
| 推送偏好 | 早晨推荐/天气变化提醒/新歌推送 开关 |
| 数据管理 | 导出/清除播放历史与偏好数据 |

### 3.6 Service Worker

- **缓存策略**：App Shell 优先缓存，API 响应网络优先
- **离线支持**：缓存最近播放的 50 首歌曲音频（需用户授权）
- **后台播放**：注册 Media Session API，支持锁屏控制
- **推送通知**：天气变化提醒、每日推荐推送

---

## 4. 后端模块详细设计

### 4.1 项目结构

```text
server/
├── index.js                # 服务入口，加载中间件与路由
├── config.js               # 配置管理（环境变量 + 配置文件）
├── routes/
│   ├── chat.js             # 聊天相关 API
│   ├── music.js            # 音乐搜索/播放 API
│   ├── weather.js          # 天气查询 API
│   ├── profile.js          # 用户画像 API
│   └── settings.js         # 设置管理 API
├── modules/
│   ├── router.js           # 意图分流模块
│   ├── context.js          # 上下文组装模块
│   ├── claudeAdapter.js    # Claude API 适配器
│   ├── scheduler.js        # 节律调度模块
│   ├── tts.js              # TTS 语音管线
│   ├── stateManager.js     # 状态记忆管理
│   └── musicEngine.js      # 音乐推荐引擎
├── services/
│   ├── netease.js          # 网易云音乐服务
│   ├── weather.js          # 天气服务
│   └── upnp.js             # UPnP/DLNA 推流服务
├── store/
│   ├── userStore.js        # 用户数据持久化
│   ├── historyStore.js     # 播放历史存储
│   └── preferenceStore.js  # 偏好模型存储
└── ws/
    └── handler.js          # WebSocket 连接与消息处理
```

### 4.2 意图分流模块 (Router_JS)

**职责**：解析用户输入，识别意图，分发到对应处理流程

**意图分类体系**：

| 意图类别 | 示例输入 | 路由目标 |
|----------|----------|----------|
| `music_request` | "来点轻音乐"、"放一首周杰伦的歌" | Claude → 音乐推荐 |
| `music_control` | "下一首"、"暂停"、"声音大一点" | 直接播放器控制 |
| `weather_query` | "今天天气怎么样" | 天气API → 展示 |
| `weather_music` | "下雨天适合听什么" | 天气API + Claude → 联合推荐 |
| `chat_casual` | "你好"、"讲个笑话" | Claude → 闲聊回复 |
| `profile_query` | "我最近都在听什么" | 状态记忆 → 数据查询 |
| `settings_change` | "把城市改成上海" | 设置模块 → 更新配置 |

**实现方式**：
1. 先用关键词+正则做快速匹配（覆盖80%常见指令）
2. 未命中则交给 Claude 做意图分类（传入意图列表+定义）
3. 返回结构化意图对象：
```json
{
  "intent": "weather_music",
  "confidence": 0.92,
  "slots": {
    "weather_hint": "rain",
    "mood": "melancholy"
  },
  "raw": "下雨天适合听什么"
}
```

### 4.3 上下文组装模块 (Context_JS)

**职责**：在调用 Claude 前，组装完整的系统提示词（System Prompt）

**上下文来源与拼接顺序**：

```text
┌─────────────────────────────────────────┐
│ 1. 系统角色定义（你是 Deepudio DJ...）     │
├─────────────────────────────────────────┤
│ 2. 用户画像摘要（品味标签/偏好/历史Top）   │
├─────────────────────────────────────────┤
│ 3. 当前状态快照                          │
│    - 时间：2026-05-21 周四 14:30         │
│    - 天气：小雨 18°C 湿度75%             │
│    - 当前活动：工作（基于日历/用户告知）    │
│    - 正在播放：XXX - YYY                 │
├─────────────────────────────────────────┤
│ 4. 最近5轮对话摘要                       │
├─────────────────────────────────────────┤
│ 5. 可用工具定义（搜索歌曲/查天气/控播放器） │
└─────────────────────────────────────────┘
```

**提示词模板示例**：
```
你是 Deepudio，一位有个性的 AI 音乐电台 DJ。

## 用户画像
- 偏好风格：流行、民谣、轻电子
- 最爱艺人：周杰伦、陈奕迅、田馥甄
- 常听场景：工作专注、通勤放松

## 当前环境
- 时间：{time} | 天气：{weather} | 温度：{temp}°C
- 用户当前状态：{state}
- 正在播放：{current_song}

## 你的能力
- 搜索和推荐歌曲（调用 search_songs / recommend_songs）
- 查询天气（调用 get_weather）
- 控制播放器（调用 player_control）

## 回复风格
- 亲切自然，像电台DJ一样有温度
- 推荐歌曲时简单说明理由
- 回复控制在2-3句话以内
```

### 4.4 Claude 适配器 (Claude_JS)

**职责**：封装与 Claude API 的所有交互，支持工具调用

**API 配置**：
- 模型：`claude-sonnet-4-6`（平衡速度与能力）
- 最大输出：1024 tokens（常规对话）/ 2048 tokens（推荐+理由）
- 开启 Prompt Caching：系统提示词 + 用户画像标记为缓存前缀

**工具定义（Tool Use）**：

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `search_songs` | `{ query, limit }` | 搜索歌曲，返回匹配列表 |
| `recommend_songs` | `{ mood, genre, weather, scene }` | 基于上下文智能推荐 |
| `get_weather` | `{ city }` | 获取指定城市天气 |
| `player_control` | `{ action: "play"|"pause"|"next"|"prev"|"volume", value? }` | 控制播放器 |
| `get_user_history` | `{ range: "7d"|"30d"|"all" }` | 获取用户播放历史 |
| `add_to_queue` | `{ song_ids }` | 将歌曲加入播放队列 |

**流式响应处理**：
- 使用 SSE 流式接收 Claude 回复
- 文本内容即时推送前端（逐字显示效果）
- 工具调用在流结束时统一执行，结果再次送入 Claude

**错误重试策略**：
- API 限流（429）：指数退避重试，最多3次
- 网络超时：30s超时，重试1次
- 上下文过长：自动裁剪对话历史，保留最近10轮

### 4.5 节律调度模块 (Scheduler_JS)

**职责**：在特定时间/事件触发自动推荐，模拟电台体验

**调度类型**：

| 调度 | 触发条件 | 动作 |
|------|----------|------|
| 早晨问候 | 每天 7:00-8:00（用户可配置） | Claude 生成早安问候 + 天气播报 + 推荐晨间歌单 |
| 天气变化 | 天气API轮询发现变化（每30分钟） | 天气骤变时推送提醒 + 匹配音乐 |
| 长时间静默 | 用户15分钟无交互且播放列表即将播完 | Claude 生成过渡语 + 自动续播推荐 |
| 场景切换 | 检测到用户状态变化（手动/日历） | 切换推荐策略（工作→专注音乐，运动→节奏音乐） |
| 周末特辑 | 周六日 10:00 | 生成周末专属歌单推荐 |

**调度器实现**：
- 基于 `node-cron` 做定时任务
- 事件驱动架构，各模块可发布事件到 EventEmitter
- 调度任务可被用户在设置中启用/禁用

### 4.6 TTS 语音管线 (TTS_JS)

**职责**：将 Claude 的文字回复转为语音播报，实现真正的"电台DJ"体验

**TTS 引擎选项**：

| 引擎 | 特点 | 适用场景 |
|------|------|----------|
| 系统TTS（Web Speech API） | 免费、零配置、效果一般 | 默认方案 |
| Edge-TTS（本地） | 免费、音质好、支持多种中文语音 | 推荐方案 |
| 第三方API（讯飞/阿里） | 音质最佳、支持情感语音 | 高级用户 |

**管线流程**：
```text
Claude文本回复 → 文本预处理（分段/加停顿标记）
                     ↓
              TTS引擎转语音（MP3/WAV）
                     ↓
              音频推流到前端（WebSocket 二进制帧）
                     ↓
              前端 AudioContext 播放
```

**与音乐播放的协调**：
- TTS 播报时自动降低音乐音量（ducking），播报完毕恢复
- 可配置"仅文字模式"关闭语音播报
- 支持"DJ模式"：歌曲开始前播报歌名和推荐理由

### 4.7 状态记忆管理 (State_OB)

**职责**：维护用户当前状态、历史状态、长期偏好模型

**状态分层**：

| 层级 | 生命周期 | 存储位置 | 内容 |
|------|----------|----------|------|
| 会话状态 | 单次连接 | 内存 | 当前对话、当前播放、临时意图 |
| 短期状态 | 1天 | SQLite | 今日播放列表、今日对话摘要 |
| 中期状态 | 30天 | SQLite | 近期偏好变化、播放频次统计 |
| 长期画像 | 永久 | SQLite | 核心品味标签、Top艺人、风格偏好 |

**用户画像数据结构**：
```json
{
  "userId": "local_user",
  "tasteProfile": {
    "genres": { "pop": 0.8, "folk": 0.6, "electronic": 0.4, "rock": 0.3 },
    "topArtists": [
      { "name": "周杰伦", "weight": 0.95, "songCount": 42 },
      { "name": "陈奕迅", "weight": 0.87, "songCount": 35 }
    ],
    "moodPreference": { "relaxed": 0.7, "energetic": 0.3, "melancholy": 0.5 },
    "scenePreference": { "work": 0.8, "commute": 0.6, "exercise": 0.2 }
  },
  "playStats": {
    "totalPlays": 1234,
    "totalDuration": 185100,
    "averageDaily": 45,
    "favoriteTimeSlot": "20:00-23:00"
  },
  "lastUpdated": "2026-05-21T14:30:00Z"
}
```

**偏好学习机制**：
- 完整播放 → 正向强化（+1 weight）
- 跳过 → 负向信号（-0.5 weight）
- 点赞/收藏 → 强正向（+3 weight）
- 对话中表达喜欢/不喜欢 → 情感分析后更新
- 每50次播放触发一次画像重新计算（加权移动平均，近期行为权重更高）

---

## 5. 外部服务集成详细设计

### 5.1 网易云音乐服务 (Netease Service)

**职责**：搜索歌曲、获取播放链接、读取歌单、获取推荐

**核心接口**：

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `search(query, limit)` | 关键词, 数量 | 歌曲列表 | 模糊搜索歌曲 |
| `getSongUrl(songId)` | 歌曲ID | 音频直链 | 获取播放地址（需VIP处理） |
| `getLyrics(songId)` | 歌曲ID | LRC歌词 | 获取逐行歌词 |
| `getUserPlaylists()` | - | 歌单列表 | 获取用户创建/收藏的歌单 |
| `getPlaylistDetail(id)` | 歌单ID | 歌曲列表 | 获取歌单内歌曲 |
| `getRecommendations()` | - | 歌曲列表 | 获取每日推荐 |
| `getArtistTopSongs(artistId)` | 艺人ID | 歌曲列表 | 获取艺人热门歌曲 |

**登录方案**：
- 主方案：Cookie 登录（用户从浏览器复制Cookie）
- 备选方案：扫码登录（调用网易云二维码API）
- Cookie 安全存储：AES加密后存入本地 SQLite

**VIP 歌曲处理**：
- 检测到VIP歌曲时，告知用户该歌曲需要VIP
- 可配置"仅推荐免费歌曲"过滤开关
- 不提供任何破解/盗链功能

**接口调用策略**：
- 请求间隔 ≥ 500ms，避免触发频率限制
- 接口失败自动重试（最多2次）
- 歌曲信息本地缓存1小时，减少API调用

### 5.2 天气服务 (Weather Service)

**职责**：获取用户所在城市天气，为音乐推荐提供天气上下文

**API 选择**：OpenWeatherMap（免费层：60次/分钟）

**核心接口**：

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getCurrentWeather(city)` | 城市名 | 当前天气 | 温度/湿度/天气状况/风速 |
| `getWeatherForecast(city)` | 城市名 | 5天预报 | 未来天气趋势 |

**天气→音乐映射规则**：

| 天气状况 | 推荐氛围 | 示例风格 |
|----------|----------|----------|
| 晴天（高温） | 轻快、活力 | 流行、雷鬼、夏天曲风 |
| 晴天（温和） | 清新、舒适 | 民谣、轻音乐、Acoustic |
| 小雨 | 忧伤、沉思 | 独立、后摇、钢琴曲 |
| 暴雨 | 强烈、释放 | 摇滚、电子、史诗配乐 |
| 雪天 | 安静、纯净 | 古典、氛围、白噪音 |
| 大风 | 动感、自由 | 电子、朋克、快节奏 |
| 多云 | 中性、随性 | Jazz、Bossa Nova |

**轮询策略**：
- 每30分钟查询一次当前天气
- 天气状态变化时发布 `weather_changed` 事件
- 天气数据本地缓存，避免重复请求

### 5.3 UPnP/DLNA 推流服务 (可选)

**职责**：发现局域网内的 UPnP 设备，将音频推送到家庭音响

**实现**：
- 使用 `node-ssdp` 做设备发现
- 使用 `upnp-client` 做设备控制
- 推流方式：后端启动本地 HTTP 音频服务器 → 通知设备拉流播放

**限制**：
- 仅支持同一局域网
- 部分设备可能不支持所有音频格式
- 标记为可选功能，不影响核心流程

---

## 6. 数据存储设计

### 6.1 存储选型

| 数据类型 | 存储方式 | 理由 |
|----------|----------|------|
| 用户画像 | SQLite | 结构化查询，本地单文件 |
| 播放历史 | SQLite | 支持时间范围查询与统计 |
| 对话历史 | SQLite | 按会话组织，支持检索 |
| 系统配置 | JSON 文件 | 简单键值，人类可读 |
| 歌曲缓存 | 文件系统 | 二进制音频文件 |

### 6.2 SQLite 表结构

```sql
-- 播放历史
CREATE TABLE play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,          -- 网易云歌曲ID
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_played INTEGER,        -- 实际播放秒数
    total_duration INTEGER,         -- 歌曲总秒数
    action TEXT,                    -- complete | skip | like
    source TEXT                     -- recommend | search | playlist
);

-- 对话记录
CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,             -- user | assistant
    content TEXT NOT NULL,
    intent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户偏好标签
CREATE TABLE user_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_type TEXT NOT NULL,         -- genre | artist | mood | scene
    tag_value TEXT NOT NULL,
    weight REAL DEFAULT 0.5,        -- 0.0 ~ 1.0
    source TEXT,                    -- auto | manual
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 每日统计快照
CREATE TABLE daily_stats (
    date DATE PRIMARY KEY,
    play_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    top_genre TEXT,
    top_artist TEXT,
    weather TEXT
);
```

### 6.3 配置文件结构 (config.json)

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "claude": {
    "apiKey": "",
    "model": "claude-sonnet-4-6",
    "maxTokens": 1024
  },
  "netease": {
    "cookie": "",
    "cacheEnabled": true,
    "freeOnly": false
  },
  "weather": {
    "city": "auto",
    "apiKey": "",
    "pollInterval": 1800
  },
  "tts": {
    "engine": "edge-tts",
    "voice": "zh-CN-XiaoxiaoNeural",
    "enabled": true,
    "djMode": true
  },
  "scheduler": {
    "morningGreeting": true,
    "morningTime": "07:30",
    "weatherAlert": true,
    "autoContinue": true,
    "silentThreshold": 900
  },
  "upnp": {
    "enabled": false,
    "deviceName": ""
  }
}
```

---

## 7. 通信协议设计

### 7.1 WebSocket 消息格式

所有前后端实时通信使用 WebSocket，消息格式统一为：

```json
{
  "type": "消息类型",
  "payload": { },
  "timestamp": 1716268800000
}
```

**消息类型定义**：

| type | 方向 | payload | 说明 |
|------|------|---------|------|
| `chat.send` | C→S | `{ content }` | 用户发送消息 |
| `chat.stream` | S→C | `{ content, done }` | AI回复流式推送 |
| `chat.intent` | S→C | `{ intent, confidence }` | 意图识别结果通知 |
| `music.recommend` | S→C | `{ songs[], reason }` | 推荐歌曲列表 |
| `music.search_result` | S→C | `{ songs[], query }` | 搜索结果 |
| `player.state` | S→C | `{ song, progress, playing }` | 播放状态同步 |
| `player.control` | C→S | `{ action, value? }` | 播放控制命令 |
| `weather.update` | S→C | `{ weather, temp, humidity }` | 天气更新推送 |
| `tts.audio` | S→C | `{ audio: base64 }` | TTS音频数据 |
| `scheduler.greeting` | S→C | `{ message, songs[] }` | 定时问候推送 |
| `system.error` | S→C | `{ code, message }` | 错误通知 |

### 7.2 REST API（辅助接口）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/weather` | 获取当前天气 |
| GET | `/api/profile` | 获取用户画像 |
| GET | `/api/profile/history?range=7d` | 获取播放历史 |
| PUT | `/api/profile/tags` | 更新偏好标签 |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/netease/login` | 网易云登录 |
| GET | `/api/netease/playlists` | 获取歌单列表 |

---

## 8. 安全设计

| 安全项 | 措施 |
|--------|------|
| API Key 保护 | Claude API Key 仅存于后端 config，不暴露给前端 |
| 网易云 Cookie | AES-256 加密存储，不通过网络明文传输 |
| WebSocket 认证 | 连接时校验 token，防止未授权访问 |
| 输入过滤 | 所有用户输入做 XSS 过滤和长度限制（500字） |
| CORS | 仅允许 localhost 和配置的域名 |
| 速率限制 | 每个 WebSocket 连接限 30条消息/分钟 |
| 数据备份 | 支持一键导出所有用户数据为 JSON |

---

## 9. 技术栈总览

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Vanilla JS / Preact | 轻量，PWA友好 |
| 前端样式 | CSS Variables + Tailwind | 主题切换 + 快速开发 |
| 前端构建 | Vite | 极速HMR，PWA插件支持 |
| 后端运行时 | Node.js 20+ | LTS，生态丰富 |
| 后端框架 | Fastify | 高性能，内置JSON Schema校验 |
| 数据库 | better-sqlite3 | 同步API，零配置，单文件 |
| AI 大脑 | Claude API (Sonnet) | 工具调用 + Prompt Caching |
| 音乐源 | 网易云音乐 API | 歌曲搜索与播放 |
| 天气源 | OpenWeatherMap API | 免费层足够个人使用 |
| TTS | Edge-TTS | 免费，中文语音质量高 |
| 定时任务 | node-cron | 成熟的cron表达式支持 |
| UPnP | node-ssdp + upnp-client | 局域网设备发现与控制 |
| 进程管理 | PM2（可选） | 生产部署守护进程 |

---

## 10. 开发阶段规划

| 阶段 | 目标 | 预计周期 | 交付物 |
|------|------|----------|--------|
| P0 - 骨架 | 基础播放器 + 聊天界面 + Claude对话 | 2周 | 可对话、可搜索播放歌曲 |
| P1 - 智能推荐 | 意图识别 + 上下文组装 + 状态感知推荐 | 2周 | 对话即推荐，天气/场景联动 |
| P2 - 个性化 | 用户画像 + 偏好学习 + 播放历史 | 1.5周 | 越用越懂你 |
| P3 - 电台体验 | 节律调度 + TTS播报 + DJ模式 | 1.5周 | 完整电台体验 |
| P4 - 打磨 | PWA离线 + UPnP推流 + 性能优化 | 1周 | 生产级可用 |

---

## 11. 目录结构总览

```text
deepudio-radio/
├── client/                     # 前端 PWA
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── workers/
│   │   └── styles/
│   ├── vite.config.js
│   └── package.json
├── server/                     # 后端 Node.js
│   ├── index.js
│   ├── config.js
│   ├── routes/
│   ├── modules/
│   ├── services/
│   ├── store/
│   └── ws/
├── data/                       # 数据目录（gitignore）
│   ├── cladio.db               # SQLite 数据库
│   ├── config.json             # 用户配置
│   └── cache/                  # 音频缓存
├── docs/                       # 文档
├── package.json                # 根 package.json（workspace）
└── README.md
```
