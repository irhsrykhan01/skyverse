const DEFAULT_BASE_URL = 'https://depay.cloud';
const RETRIES = 1;
const TIMEOUT_MS = 18_000;
const MAX_DIRECT_MEDIA_BYTES = 60 * 1024 * 1024;

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestMedia(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json, image/*, video/*, audio/*',
          'user-agent': 'SkyVerse/1.0 (+https://github.com/irhsrykhan01/skyverse)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = `Depay request failed (${response.status})`;
        try {
          const body = text ? JSON.parse(text) : null;
          message = body?.error?.message ?? body?.error ?? body?.message ?? message;
        } catch {}

        const error = new Error(`${message} [Depay HTTP ${response.status}]`);
        error.provider = 'Depay';
        error.status = response.status;
        if (!retryableStatus(response.status) || attempt >= RETRIES) throw error;

        lastError = error;
        const retryAfter = Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5_000) : 500 * (attempt + 1));
        continue;
      }

      if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')
        || contentType.includes('octet-stream')) {
        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > MAX_DIRECT_MEDIA_BYTES) {
          throw new Error('Media dari Depay terlalu besar untuk diproses.');
        }
        const media = Buffer.from(await response.arrayBuffer());
        if (!media.length) throw new Error('Depay mengembalikan media kosong.');
        if (media.length > MAX_DIRECT_MEDIA_BYTES) {
          throw new Error('Media dari Depay terlalu besar untuk diproses.');
        }
        return { media, mimeType: contentType.split(';', 1)[0] };
      }

      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        throw new Error('Depay mengembalikan respons non-JSON yang tidak dikenal.');
      }
      if (!body || typeof body !== 'object') throw new Error('Depay mengembalikan respons kosong.');
      if (body.status === false || body.error) {
        throw new Error(String(body.error?.message ?? body.error ?? body.message ?? 'Depay menolak request.'));
      }
      return body;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = !status || retryableStatus(status)
        || ['AbortError', 'TimeoutError'].includes(error?.name)
        || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message ?? ''));
      if (!retryable || attempt >= RETRIES) throw error;
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError ?? new Error('Depay request failed.');
}

export function createDepayProvider({ baseUrl = DEFAULT_BASE_URL } = {}) {
  async function generator(path, params) {
    return requestMedia(buildUrl(baseUrl, path, params));
  }

  return Object.freeze({
    brat: (text) => generator('/api/generator/brat', { text }),
    iqc: (prompt) => generator('/api/generator/iqc', { prompt }),
    tiktok: (url) => generator('/api/downloader/tiktok', { url }),
    facebook: (url) => generator('/api/downloader/facebook', { url }),
    instagram: (url) => generator('/api/downloader/igdownload', { url }),
    youtube: (url, type = 'video') => generator('/api/downloader/ytdl', { url, type }),
  });
}
