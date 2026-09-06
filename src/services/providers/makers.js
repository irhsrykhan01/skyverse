const DEFAULT_BRAT_BASE_URL = 'https://aqul-brat.hf.space';
const DEFAULT_NEXRAY_BASE_URL = 'https://api.nexray.web.id';
const RETRIES = 2;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinUrl(baseUrl, path = '') {
  return new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function retryable(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function requestMedia(url, { maxBytes = 12 * 1024 * 1024 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/*, application/json, */*' },
        signal: AbortSignal.timeout(30_000),
      });

      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = `Maker request failed (${response.status})`;
        try {
          const body = text ? JSON.parse(text) : null;
          message = body?.error?.message ?? body?.error ?? body?.message ?? message;
        } catch {}
        const error = new Error(`${message} [${url}]`);
        error.status = response.status;
        if (!retryable(response.status) || attempt >= RETRIES) throw error;
        lastError = error;
        await wait(500 * (attempt + 1));
        continue;
      }

      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > maxBytes) throw new Error('Media dari maker terlalu besar untuk diproses.');

      if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        const media = Buffer.from(await response.arrayBuffer());
        if (!media.length) throw new Error('Maker mengembalikan media kosong.');
        if (media.length > maxBytes) throw new Error('Media dari maker terlalu besar untuk diproses.');
        return { media, mimeType: contentType.split(';', 1)[0] };
      }

      const text = await response.text();
      if (!text) throw new Error('Maker mengembalikan response kosong.');
      try {
        const body = JSON.parse(text);
        if (body && typeof body === 'object' && body.status === false) {
          throw new Error(String(body.error?.message ?? body.error ?? body.message ?? 'Maker menolak request.'));
        }
        return body;
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes('Maker menolak request')) throw parseError;
        throw new Error('Response maker bukan media atau JSON yang valid.');
      }
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retry = !status || retryable(status) || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(String(error?.message ?? ''));
      if (!retry || attempt >= RETRIES) throw error;
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError ?? new Error('Maker request failed.');
}

function progressivePhrases(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  if (words.length === 1) return [words[0], words[0]];
  return words.map((_, index) => words.slice(0, index + 1).join(' '));
}

export function createMakerProvider({
  bratBaseUrl = DEFAULT_BRAT_BASE_URL,
  nexrayBaseUrl = DEFAULT_NEXRAY_BASE_URL,
} = {}) {
  const brat = (text) => requestMedia(
    `${joinUrl(bratBaseUrl)}/?text=${encodeURIComponent(String(text).trim())}`,
  );

  const bratFrames = async (text) => {
    const phrases = progressivePhrases(text);
    if (!phrases.length) throw new Error('Teks Brat tidak boleh kosong.');
    const frames = [];
    for (const phrase of phrases) {
      const result = await brat(phrase);
      if (!result?.media || !Buffer.isBuffer(result.media)) {
        throw new Error('Brat API tidak mengembalikan gambar yang valid.');
      }
      frames.push(result.media);
    }
    return frames;
  };

  const iqc = (text) => requestMedia(
    `${joinUrl(nexrayBaseUrl, '/maker/iqc')}?text=${encodeURIComponent(String(text).trim())}`,
  );

  return Object.freeze({ brat, bratFrames, iqc });
}
