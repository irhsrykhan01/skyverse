const DEFAULT_BASE_URL = 'https://depay.cloud';

function buildUrl(baseUrl, path, params = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestMedia(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json, image/*, video/*' },
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
    throw new Error(String(message));
  }

  if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
    return {
      media: Buffer.from(await response.arrayBuffer()),
      mimeType: contentType.split(';', 1)[0],
    };
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function createDepayProvider({ baseUrl = DEFAULT_BASE_URL } = {}) {
  async function generator(path, params) {
    return requestMedia(buildUrl(baseUrl, path, params));
  }

  return Object.freeze({
    brat: (text) => generator('/api/generator/brat', { text }),
    iqc: (prompt) => generator('/api/generator/iqc', { prompt }),
  });
}
