const DEFAULT_BASE_URL = 'https://tdownv4.sl-bjs.workers.dev/';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TIMEOUT_MS = 15_000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createProviderError(message, { status = null, cause = null } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.provider = 'TikTok Worker';
  if (status !== null) error.status = status;
  return error;
}

async function requestJson(url, { timeoutMs = TIMEOUT_MS } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'SkyVerse/1.0 (+https://github.com/irhsrykhan01/skyverse)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        const message = body?.error?.message ?? body?.error ?? body?.message ?? 'HTTP ' + response.status;
        const error = createProviderError('TikTok Worker gagal (' + response.status + '): ' + String(message), { status: response.status });
        if (!RETRYABLE_STATUS.has(response.status) || attempt === 1) throw error;
        lastError = error;
        const retryAfter = Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5_000) : 700);
        continue;
      }

      if (!body || typeof body !== 'object') {
        throw createProviderError('TikTok Worker mengembalikan respons non-JSON atau kosong.');
      }
      if (body.status === false || body.error) {
        const message = body.error?.message ?? body.error ?? body.message ?? 'Permintaan ditolak provider.';
        throw createProviderError('TikTok Worker menolak permintaan: ' + String(message));
      }
      return body;
    } catch (error) {
      lastError = error;
      const retryable = RETRYABLE_STATUS.has(Number(error?.status))
        || ['AbortError', 'TimeoutError'].includes(error?.name)
        || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message ?? ''));
      if (!retryable || attempt === 1) throw error;
      await wait(700);
    }
  }

  throw lastError ?? createProviderError('TikTok Worker gagal tanpa detail error.');
}

export function createTikTokWorkerProvider({ baseUrl = DEFAULT_BASE_URL } = {}) {
  return Object.freeze({
    tiktok(url) {
      const endpoint = new URL(baseUrl);
      endpoint.searchParams.set('down', String(url));
      return requestJson(endpoint);
    },
  });
}
