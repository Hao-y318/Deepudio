// 节律调度模块 - 在特定时间/事件触发自动推荐

import cron from 'node-cron';
import { loadConfig } from '../config.js';
import { getState, updateContext, isIdle } from './stateManager.js';
import { getProfile } from '../store/preferenceStore.js';

const activeJobs = new Map();
let onEvent = null; // callback to push events to client

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

async function triggerMorningGreeting() {
  if (!onEvent) return;
  onEvent({
    type: 'scheduler.greeting',
    payload: {
      message: '早安！新的一天开始了',
      greetingType: 'morning'
    }
  });
}

function checkSilentContinue() {
  if (!onEvent) return;
  const config = loadConfig();
  if (isIdle(config.scheduler.silentThreshold * 1000)) {
    onEvent({
      type: 'scheduler.idle',
      payload: { message: '很久没有互动了，需要我推荐些音乐吗？' }
    });
  }
}

export function handleWeatherChange(newWeather, oldWeather) {
  if (!onEvent) return;
  if (oldWeather && newWeather.description !== oldWeather.description) {
    onEvent({
      type: 'scheduler.weather_change',
      payload: {
        message: `天气变了，现在${newWeather.description}`,
        weather: newWeather
      }
    });
  }
}
