const DEFAULT_BASE_URL = 'https://www.keyrafara.com';

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.error?.message || body?.error || `HTTP ${response.status}`;
    throw new Error(`Keyra request failed (${response.status}): ${message}`);
  }
  return body;
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
    const suffix = query.toString() ? `?${query.toString()}` : '';
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
