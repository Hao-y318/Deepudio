import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const CONFIG_PATH = join(DATA_DIR, 'config.json');

const DEFAULT_CONFIG = {
  server: {
    port: 8080,
    host: '0.0.0.0'
  },
  ai: {
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com/v1',
    maxTokens: 1024
  },
  netease: {
    cookie: '',
    likedPlaylistId: '',
    extraPlaylistIds: [],
    cacheEnabled: true,
    freeOnly: false
  },
  localMusic: {
    folder: '',
    jsonFile: '',
    enabled: true
  },
  weather: {
    enabled: false,
    city: 'auto',
    apiKey: '',
    pollInterval: 1800
  },
  tts: {
    engine: 'edge-tts',
    voice: 'zh-CN-XiaoxiaoNeural',
    enabled: true,
    djMode: true
  },
  scheduler: {
    morningGreeting: true,
    morningTime: '07:30',
    weatherAlert: true,
    autoContinue: true,
    silentThreshold: 900
  },
  upnp: {
    enabled: false,
    deviceName: ''
  }
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      const userConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      return deepMerge(DEFAULT_CONFIG, userConfig);
    } catch { /* corrupt config, use default */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function updateConfig(partial) {
  const current = loadConfig();
  const merged = deepMerge(current, partial);
  saveConfig(merged);
  return merged;
}

export { DATA_DIR };
