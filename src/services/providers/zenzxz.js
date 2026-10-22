import { buildUrl, ensureProviderSuccess, requestResource } from './http.js';

export function createZenzxzProvider({ baseUrl = 'https://api.zenzxz.my.id' } = {}) {
  const call = async (path, params = {}) => ensureProviderSuccess(
    await requestResource(buildUrl(baseUrl, path, params), { retries: 1 }),
    'zenzxz',
  );

  return Object.freeze({
    call,
    youtube: (url) => call('/downloader/ytmp4v2', { url }),
    youtubeMp3: (url) => call('/downloader/ytmp3v2', { url }),
    facebook: (url) => call('/downloader/facebook', { url }),
    brat: (text) => call('/maker/brat', { text }),
    bratVideo: (text) => call('/maker/bratvid', { text }),
  });
}
