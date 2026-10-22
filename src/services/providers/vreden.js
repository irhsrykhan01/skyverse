import { buildUrl, requestResource } from './http.js';

export function createVredenProvider({ baseUrl = 'https://api.vreden.my.id' } = {}) {
  const call = (path, params = {}) => requestResource(buildUrl(baseUrl, path, params), { retries: 1 });

  return Object.freeze({
    call,
    youtube: (url) => call('/api/v1/download/youtube/video', { url, quality: 720 }),
    youtubeMp3: (url) => call('/api/v1/download/youtube/audio', { url, quality: 128 }),
  });
}
