// 天气服务 - 获取用户所在城市天气
// 优先使用 OpenWeatherMap API，无 Key 时使用免费 wttr.in

import { loadConfig } from '../config.js';
import { updateContext, getState } from '../modules/stateManager.js';
import { handleWeatherChange } from '../modules/scheduler.js';

let pollTimer = null;

export async function getCurrentWeather(city) {
  const config = loadConfig();
  const targetCity = city || config.weather.city || 'auto';

  // 有 API Key 就用 OpenWeatherMap
  if (config.weather.apiKey) {
    const cityName = targetCity === 'auto' ? 'Shanghai' : targetCity;
    const result = await fetchOWMWeather(cityName, config.weather.apiKey);
    if (result && result.description !== '获取失败') return result;
  }

  // 备选：免费 wttr.in API（不需要 Key）
  return await fetchWttrWeather(targetCity);
}

async function fetchOWMWeather(city, apiKey) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=zh_cn`;
    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`OpenWeatherMap error: ${resp.status}`);
    }

    const data = await resp.json();

    return {
      city: data.name,
      description: data.weather?.[0]?.description || '未知',
      temp: Math.round(data.main?.temp),
      humidity: data.main?.humidity,
      windSpeed: data.wind?.speed,
      icon: data.weather?.[0]?.icon,
      updatedAt: Date.now()
    };
  } catch (err) {
    console.error('OpenWeatherMap fetch failed:', err.message);
    return null;
  }
}

async function fetchWttrWeather(city) {
  try {
    const queryCity = city === 'auto' ? '' : city;
    const url = `https://wttr.in/${encodeURIComponent(queryCity)}?format=j1&lang=zh`;
    const resp = await fetch(url);

    if (!resp.ok) {
      return { description: '天气不可用', temp: null, humidity: null, city: city };
    }

    const data = await resp.json();
    const current = data.current_condition?.[0];

    if (!current) {
      return { description: '天气不可用', temp: null, humidity: null, city: city };
    }

    // 英文描述转中文
    const descMap = {
      'Sunny': '晴', 'Clear': '晴', 'Partly cloudy': '多云', 'Cloudy': '阴',
      'Overcast': '阴', 'Mist': '薄雾', 'Fog': '雾', 'Light rain': '小雨',
      'Moderate rain': '中雨', 'Heavy rain': '大雨', 'Light snow': '小雪',
      'Moderate snow': '中雪', 'Heavy snow': '大雪', 'Thunder': '雷阵雨',
      'Drizzle': '毛毛雨', 'Patchy rain nearby': '局部有雨',
      'Light drizzle': '毛毛雨', 'Patchy light rain': '局部小雨'
    };

    const descEn = current.weatherDesc?.[0]?.value || '';
    const descCn = descMap[descEn] || current.lang_zh?.[0]?.value || descEn;

    return {
      city: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
      description: descCn,
      temp: parseInt(current.temp_C),
      humidity: parseInt(current.humidity),
      windSpeed: parseInt(current.windspeedKmph),
      icon: null,
      updatedAt: Date.now()
    };
  } catch (err) {
    console.error('wttr.in fetch failed:', err.message);
    return { description: '获取失败', temp: null, humidity: null, city: city };
  }
}

export async function getWeatherForecast(city) {
  const config = loadConfig();

  if (config.weather.apiKey) {
    const targetCity = city || config.weather.city || 'Shanghai';
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(targetCity)}&appid=${config.weather.apiKey}&units=metric&lang=zh_cn`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();

      return (data.list || []).slice(0, 8).map(item => ({
        time: item.dt_txt,
        description: item.weather?.[0]?.description,
        temp: Math.round(item.main?.temp),
        humidity: item.main?.humidity
      }));
    } catch {
      return [];
    }
  }

  // wttr.in 免费预报
  try {
    const queryCity = city || config.weather.city || 'auto';
    const url = `https://wttr.in/${encodeURIComponent(queryCity === 'auto' ? '' : queryCity)}?format=j1&lang=zh`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();

    return (data.weather || []).slice(0, 3).map(w => ({
      time: w.date,
      description: w.hourly?.[4]?.lang_zh?.[0]?.value || w.hourly?.[4]?.weatherDesc?.[0]?.value || '',
      temp: parseInt(w.mintempC),
      humidity: parseInt(w.hourly?.[4]?.humidity || 50)
    }));
  } catch {
    return [];
  }
}

export function startWeatherPolling() {
  const config = loadConfig();

  pollWeather();

  const interval = (config.weather.pollInterval || 1800) * 1000;
  pollTimer = setInterval(pollWeather, interval);
}

export function stopWeatherPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollWeather() {
  const weather = await getCurrentWeather();
  const oldWeather = getState().context.weather;
  updateContext({ weather });

  if (oldWeather && weather.description !== oldWeather.description) {
    handleWeatherChange(weather, oldWeather);
  }
}
