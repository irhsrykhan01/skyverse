const DEFAULT_BASE_URL = 'https://download-tktk-video.drummerduck.com';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TIMEOUT_MS = 45_000;
const MAX_MEDIA_BYTES = 60 * 1024 * 1024;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeError(message, { status = null, cause = null } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.provider = 'DrummerDuck';
  if (status !== null) error.status = status;
  return error;
}

async function readLimited(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw makeError('File TikTok melebihi batas 60 MB.');
    return buffer;
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw makeError('File TikTok melebihi batas 60 MB.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function extractErrorMessage(text, fallback) {
  try {
    const body = text ? JSON.parse(text) : null;
    return String(
      body?.error?.message
      ?? body?.error?.description
      ?? body?.error
      ?? body?.message
      ?? fallback,
    );
  } catch {
    return text?.trim().slice(0, 180) || fallback;
  }
}

function isMp4(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 16
    && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

async function requestVideo(url, {
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = TIMEOUT_MS,
  maxBytes = MAX_MEDIA_BYTES,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw makeError('Fetch tidak tersedia pada runtime Node.js ini.');
  }

  const endpoint = new URL('/api/download', baseUrl);
  endpoint.searchParams.set('url', String(url));
  endpoint.searchParams.set('quality', '1080p');

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          accept: 'video/mp4, application/octet-stream, application/json',
          'user-agent': 'Mozilla/5.0 (compatible; SkyVerse/1.0; +https://github.com/irhsrykhan01/skyverse)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });

      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = makeError(
          'DrummerDuck HTTP ' + response.status + ': '
            + extractErrorMessage(text, response.statusText || 'Permintaan gagal.'),
          { status: response.status },
        );
        if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) throw error;
        lastError = error;
        const retryAfter = Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5_000)
          : 600 * (attempt + 1));
        continue;
      }

      if (/^(text\/|application\/(json|javascript|xml))/.test(contentType)) {
        const text = await response.text().catch(() => '');
        throw makeError(
          'DrummerDuck tidak mengirim file MP4: '
            + extractErrorMessage(text, contentType || 'respons bukan media'),
        );
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > maxBytes) {
        throw makeError('File TikTok melebihi batas 60 MB.');
      }

      const media = await readLimited(response, maxBytes);
      if (!media.length || !isMp4(media)) {
        throw makeError('DrummerDuck tidak mengembalikan file MP4 yang valid.');
      }
      return Object.freeze({ media, mimeType: 'video/mp4' });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = RETRYABLE_STATUS.has(status)
        || ['AbortError', 'TimeoutError'].includes(error?.name)
        || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message ?? ''));
      if (!retryable || attempt === 1) throw error;
      await wait(600 * (attempt + 1));
    }
  }

  throw lastError ?? makeError('DrummerDuck gagal tanpa detail error.');
}

export function createDrummerDuckProvider(options = {}) {
  return Object.freeze({
    tiktok: (url) => requestVideo(url, options),
  });
}
