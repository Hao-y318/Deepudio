// 节律调度模块 - 在特定时间/事件触发AI智能播报

import cron from 'node-cron';
import { loadConfig } from '../config.js';
import { getState, updateContext, isIdle } from './stateManager.js';
import { getProfile } from '../store/preferenceStore.js';
import { chat } from './deepseekAdapter.js';

const activeJobs = new Map();
let onEvent = null;

export function setEventHandler(handler) {
  onEvent = handler;
}

export function startScheduler() {
  const config = loadConfig();
  stopScheduler();

  if (config.scheduler.morningGreeting) {
    const [h, m] = config.scheduler.morningTime.split(':').map(Number);
    const cronExpr = `${m} ${h} * * *`;
    const job = cron.schedule(cronExpr, () => triggerMorningGreeting(), { timezone: 'Asia/Shanghai' });
    activeJobs.set('morning', job);
  }

  if (config.scheduler.autoContinue) {
    const job = cron.schedule('*/5 * * * *', () => checkSilentContinue());
    activeJobs.set('silent', job);
  }
}

export function stopScheduler() {
  for (const [, job] of activeJobs) {
    job.stop();
  }
  activeJobs.clear();
}

// ---------- AI 播报辅助 ----------

async function aiSay(systemPrompt) {
  const config = loadConfig();
  if (!config.ai.apiKey) return null;
  try {
    const result = await chat(systemPrompt, [], null);
    return result.content?.trim() || null;
  } catch (err) {
    console.error('Scheduler AI call failed:', err.message);
    return null;
  }
}

function buildWeatherContext(weather) {
  if (!weather || !weather.description) return '';
  const temp = weather.temp != null ? `，温度${Math.round(weather.temp)}°C` : '';
  const humidity = weather.humidity != null ? `，湿度${weather.humidity}%` : '';
  return `当前天气：${weather.description}${temp}${humidity}。`;
}

// ---------- 早安问候 ----------

async function triggerMorningGreeting() {
  if (!onEvent) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];

  const state = getState();
  const weatherCtx = buildWeatherContext(state.weather);

  const prompt = [
    `你是 Deepudio Radio 的 AI 电台 DJ。`,
    `现在是${weekday} ${timeStr}。${weatherCtx}`,
    `请用自然、温暖、口语化的口吻向听众道早安。`,
    `根据天气和时间推荐今天适合听的音乐风格或心情。`,
    `不要用"亲爱的用户""尊敬的听众"等正式称呼。`,
    `一句话，不超过60字。`
  ].join(' ');

  const aiMsg = await aiSay(prompt);
  const message = aiMsg || '早安！新的一天开始了~';

  onEvent({
    type: 'scheduler.greeting',
    payload: { message, greetingType: 'morning' }
  });
}

// ---------- 静默提醒 ----------

async function checkSilentContinue() {
  if (!onEvent) return;
  const config = loadConfig();
  if (!isIdle(config.scheduler.silentThreshold * 1000)) return;

  const state = getState();
  const idleMinutes = Math.floor((Date.now() - (state.lastInteraction || 0)) / 60000);

  const prompt = [
    `你是 Deepudio Radio 的 AI 电台 DJ。`,
    `听众已经 ${idleMinutes} 分钟没有互动了。`,
    `请用轻松、不打扰的口吻问ta是否需要推荐音乐。`,
    `可以顺便提一句当前时间适合听什么类型的歌。`,
    `一句话，不超过40字。`
  ].join(' ');

  const aiMsg = await aiSay(prompt);
  const message = aiMsg || '好久没互动了，需要我推荐些音乐吗？';

  onEvent({
    type: 'scheduler.idle',
    payload: { message, type: 'idle' }
  });
}

// ---------- 天气变化播报 ----------

export async function handleWeatherChange(newWeather, oldWeather) {
  if (!onEvent) return;
  if (!oldWeather || newWeather.description === oldWeather.description) return;

  const weatherCtx = buildWeatherContext(newWeather);
  const oldCtx = oldWeather.description ? `之前是${oldWeather.description}` : '';

  const prompt = [
    `你是 Deepudio Radio 的 AI 电台 DJ。`,
    `天气发生了变化：${oldCtx}，${weatherCtx}`,
    `请用口语化的口吻播报天气变化，并推荐适合当前天气的音乐。`,
    `一句话，不超过60字。`
  ].join(' ');

  const aiMsg = await aiSay(prompt);
  const message = aiMsg || `天气变了，现在是${newWeather.description}`;

  onEvent({
    type: 'scheduler.weather_change',
    payload: { message, weather: newWeather }
  });
}
