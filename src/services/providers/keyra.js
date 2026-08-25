const DEFAULT_BASE_URL = 'https://www.keyrafara.com/api';

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`Keyra request failed (${response.status})`);
  return body;
}

export function createKeyraProvider({ apiKey = null, baseUrl = DEFAULT_BASE_URL } = {}) {
  async function maker(path, params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    if (apiKey) query.set('api_key', apiKey);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return requestJson(joinUrl(baseUrl, path) + suffix);
  }

  return Object.freeze({
    brat: (text) => maker('/maker/brat', { text }),
    bratVideo: (text) => maker('/maker/brat-vid', { text }),
    iqc: (text) => maker('/maker/iqc', { text }),
    quote: (text) => maker('/maker/quote', { text }),
  });
}
