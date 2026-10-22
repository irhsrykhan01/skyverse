import { buildUrl, ensureProviderSuccess, requestResource } from './http.js';

export function createSiputzxProvider({ baseUrl = 'https://api.siputzx.my.id' } = {}) {
  const call = async (path, params = {}) => ensureProviderSuccess(
    await requestResource(buildUrl(baseUrl, path, params), { retries: 2, timeout: 45_000 }),
    'siputzx',
  );

  return Object.freeze({
    call,
    youtube: (url) => call('/api/d/ytmp4', { url }),
    youtubeMp3: (url) => call('/api/d/ytmp3', { url }),
  });
}
