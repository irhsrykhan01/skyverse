function retryable(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function buildUrl(baseUrl, path = '', params = {}) {
  const url = new URL(String(path).replace(/^\/+/, ''), `${String(baseUrl).replace(/\/+$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

export async function requestResource(url, {
  method = 'GET',
  headers = {},
  body,
  timeout = 30_000,
  retries = 1,
  maxBytes = 50 * 1024 * 1024,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      const type = String(response.headers.get('content-type') ?? '').toLowerCase();
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const error = new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
        error.status = response.status;
        throw error;
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > maxBytes) throw new Error('Response provider terlalu besar.');
      if (/^(image|video|audio)\//.test(type) || type.includes('octet-stream')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length) throw new Error('Provider mengembalikan media kosong.');
        if (buffer.length > maxBytes) throw new Error('Response provider terlalu besar.');
        return buffer;
      }
      const text = await response.text();
      if (!text) return null;
      if (type.includes('json') || /^[\[{]/.test(text.trim())) {
        try { return JSON.parse(text); } catch {}
      }
      return text;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const canRetry = !status || retryable(status) || /timeout|fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(String(error?.message ?? ''));
      if (!canRetry || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error('Provider request gagal.');
}

export function ensureProviderSuccess(value, label = 'Provider') {
  if (value && typeof value === 'object') {
    if (value.status === false || value.success === false) {
      const message = value.error?.message ?? value.error ?? value.message ?? `${label} menolak request.`;
      throw new Error(String(message));
    }
  }
  return value;
}
