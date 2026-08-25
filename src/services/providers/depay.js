const DEFAULT_BASE_URL = 'https://depay.cloud';

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`Depay request failed (${response.status})`);
  return body;
}

export function createDepayProvider({ baseUrl = DEFAULT_BASE_URL } = {}) {
  async function generator(path, params) {
    return requestJson(buildUrl(baseUrl, path, params));
  }

  return Object.freeze({
    brat: (text) => generator('/api/generator/brat', { text }),
    iqc: (prompt) => generator('/api/generator/iqc', { prompt }),
  });
}
