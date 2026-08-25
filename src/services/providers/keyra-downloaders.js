const DEFAULT_BASE_URL = 'https://www.keyrafara.com';

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(url, apiKey = null) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? `HTTP ${response.status}`;
    throw new Error(`Keyra downloader failed (${response.status}): ${String(message)}`);
  }
  if (body && typeof body === 'object' && body.status === false) {
    const message = body.error?.message ?? body.error ?? 'Unknown provider error';
    throw new Error(`Keyra downloader rejected request: ${String(message)}`);
  }
  return body;
}

export function createKeyraDownloaderProvider({ baseUrl = DEFAULT_BASE_URL, apiKey = null } = {}) {
  const call = (path, params) => requestJson(buildUrl(baseUrl, path, params), apiKey);
  return Object.freeze({
    tiktok: (url) => call('/downloaders/tiktok', { url }),
    youtube: (url) => call('/downloaders/youtube', { url }),
    youtubeMp3: (url) => call('/downloaders/youtube-mp3', { url }),
    instagram: (url) => call('/downloaders/instagram', { url }),
    facebook: (url) => call('/downloaders/facebook', { url }),
  });
}
