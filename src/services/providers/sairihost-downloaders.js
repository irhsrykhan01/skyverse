import { buildUrl, requestResource, ensureProviderSuccess } from './http.js';

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

function validateTikTokUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error('URL TikTok tidak valid.');
  }

  if (url.protocol !== 'https:' || !TIKTOK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('SairiHost hanya menerima tautan HTTPS TikTok yang didukung.');
  }

  return url.toString();
}

export function createSairiHostDownloaderProvider({
  baseUrl = 'https://api.sairihost.com',
  apiKey = null,
} = {}) {
  async function tiktok(inputUrl) {
    if (!apiKey) {
      throw new Error('SAIRIHOST_API_KEY belum dikonfigurasi.');
    }

    const url = validateTikTokUrl(inputUrl);
    const response = ensureProviderSuccess(await requestResource(
      buildUrl(baseUrl, '/api/download/tiktok', { url }),
      {
        headers: {
          accept: 'application/json',
          'X-Api-Key': apiKey,
        },
        timeout: 45_000,
        retries: 0,
        maxBytes: 2 * 1024 * 1024,
      },
    ), 'SairiHost TikTok');

    const result = response?.result ?? response?.data;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('SairiHost TikTok tidak mengembalikan data media yang valid.');
    }

    return response;
  }

  return Object.freeze({ tiktok });
}
