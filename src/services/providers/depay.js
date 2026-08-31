const DEFAULT_BASE_URL = 'https://depay.cloud';
const RETRIES = 2;

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

async function requestMedia(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json, image/*, video/*, audio/*' },
        signal: AbortSignal.timeout(30_000),
      });

      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = `Depay request failed (${response.status})`;
        try {
          const body = text ? JSON.parse(text) : null;
          message = body?.error?.message ?? body?.error ?? body?.message ?? message;
        } catch {}

        const error = new Error(`${message} [${url}]`);
        error.status = response.status;
        if (!retryableStatus(response.status) || attempt >= RETRIES) throw error;

        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }

      if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        const media = Buffer.from(await response.arrayBuffer());
        if (!media.length) throw new Error('Depay mengembalikan media kosong.');
        return { media, mimeType: contentType.split(';', 1)[0] };
      }

      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      if (body && typeof body === 'object' && body.status === false) {
        throw new Error(String(body.error?.message ?? body.error ?? body.message ?? 'Depay menolak request.'));
      }
      return body ?? text;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = !status || retryableStatus(status) || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(String(error?.message ?? ''));
      if (!retryable || attempt >= RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
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
    youtube: (url, type = 'video') => generator('/api/downloader/ytdl', { url, type }),
  });
}
