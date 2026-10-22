import { requestResource } from './http.js';

export function createTikwmProvider({ baseUrl = 'https://www.tikwm.com/api/' } = {}) {
  async function tiktok(url) {
    const response = await requestResource(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        origin: 'https://www.tikwm.com',
        referer: 'https://www.tikwm.com/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/139 Mobile Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      body: new URLSearchParams({ url, hd: '1' }),
      retries: 2,
    });
    if (!response || Number(response.code) !== 0 || !response.data) {
      throw new Error(response?.msg ?? 'TikWM gagal mengambil data TikTok.');
    }
    const data = response.data;
    return {
      result: {
        title: data.title ?? null,
        video: data.play ?? null,
        videoWatermark: data.wmplay ?? null,
        audio: data.music ?? null,
        images: Array.isArray(data.images) ? data.images : [],
      },
    };
  }
  return Object.freeze({ tiktok });
}
