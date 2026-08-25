const DEFAULT_BASE_URL = 'https://www.keyrafara.com';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function joinUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}, attempt = 0) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      if (RETRYABLE_STATUS.has(response.status) && attempt < 1) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 10_000)
          : 1_000;
        await wait(delay);
        return requestJson(url, options, attempt + 1);
      }

      const message = body?.error?.message ?? body?.error ?? `HTTP ${response.status}`;
      throw new Error(`Keyra request failed (${response.status}): ${String(message)}`);
    }

    if (body && typeof body === 'object' && body.status === false) {
      const message = body.error?.message ?? body.error ?? 'Unknown provider error';
      throw new Error(`Keyra rejected request: ${String(message)}`);
    }

    return body;
  } catch (error) {
    if (attempt < 1 && (error?.name === 'AbortError' || error?.name === 'TimeoutError')) {
      await wait(1_000);
      return requestJson(url, options, attempt + 1);
    }
    throw error;
  }
}

function withApiKey(headers, apiKey) {
  if (!apiKey) return headers;
  return { ...headers, 'x-api-key': apiKey };
}

export function createKeyraProvider({ apiKey = null, baseUrl = DEFAULT_BASE_URL } = {}) {
  async function maker(path, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }

    const suffix = query.toString() ? `?${query}` : '';
    return requestJson(joinUrl(baseUrl, path) + suffix, {
      headers: withApiKey({}, apiKey),
    });
  }

  return Object.freeze({
    brat: (text) => maker('/maker/brat', { text }),
    bratVideo: (text) => maker('/maker/brat-vid', { text }),
    iqc: (text) => maker('/maker/iqc', { text }),
    quote: (text) => maker('/maker/quote', { text }),
  });
}
