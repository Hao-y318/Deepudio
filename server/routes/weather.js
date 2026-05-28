// 天气相关 API 路由

import { getCurrentWeather, getWeatherForecast } from '../services/weather.js';

export default async function weatherRoutes(fastify) {
  fastify.get('/api/weather', async (request) => {
    const city = request.query.city;
    return await getCurrentWeather(city);
  });

  fastify.get('/api/weather/forecast', async (request) => {
    const city = request.query.city;
    return await getWeatherForecast(city);
  });
}
