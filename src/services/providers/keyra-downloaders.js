const DEFAULT_BASE_URL = 'https://www.keyrafara.com';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TIMEOUT_MS = 18_000;

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerError(message, { status = null, cause = null } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.provider = 'Keyra';
  if (status !== null) error.status = status;
  return error;
}

async function requestJson(url, apiKey = null) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          'user-agent': 'SkyVerse/1.0 (+https://github.com/irhsrykhan01/skyverse)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        const message = body?.error?.message ?? body?.error ?? body?.message ?? `HTTP ${response.status}`;
        const error = providerError(`Keyra gagal (${response.status}): ${String(message)}`, { status: response.status });
        if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) throw error;
        lastError = error;
        const retryAfter = Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5_000) : 800);
        continue;
      }

      if (!body || typeof body !== 'object') {
        throw providerError('Keyra mengembalikan respons non-JSON atau kosong.');
      }
      if (body.status === false || body.error) {
        const message = body.error?.message ?? body.error ?? body.message ?? 'Permintaan ditolak provider.';
        throw providerError(`Keyra menolak permintaan: ${String(message)}`);
      }
      return body;
    } catch (error) {
      lastError = error;
      const retryable = RETRYABLE_STATUS.has(Number(error?.status))
        || ['AbortError', 'TimeoutError'].includes(error?.name)
        || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message ?? ''));
      if (!retryable || attempt === 1) throw error;
      await wait(800);
    }
  }

  throw lastError ?? providerError('Keyra gagal tanpa detail error.');
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
