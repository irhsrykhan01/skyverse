const DEFAULT_BRAT_BASE_URL = 'https://aqul-brat.hf.space';
const DEFAULT_NEXRAY_BASE_URL = 'https://api.nexray.web.id';
const RETRIES = 2;
const MAX_BRAT_TEXT_LENGTH = 250;
const MAX_BRATVID_FRAMES = 24;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, '');
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
      const body = JSON.parse(text);
      if (body && typeof body === 'object' && body.status === false) {
        throw new Error(String(body.error?.message ?? body.error ?? body.message ?? 'Maker menolak request.'));
      }
      return body;
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

function validateBratText(text) {
  const value = String(text).trim();
  if (!value) throw new Error('Teks Brat tidak boleh kosong.');
  if (value.length > MAX_BRAT_TEXT_LENGTH) throw new Error(`Teks Brat maksimal ${MAX_BRAT_TEXT_LENGTH} karakter.`);
  return value;
}

function progressivePhrases(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const limited = words.slice(0, MAX_BRATVID_FRAMES);
  if (limited.length === 1) return [limited[0], limited[0]];
  return limited.map((_, index) => limited.slice(0, index + 1).join(' '));
}

export function createMakerProvider({
  bratBaseUrl = DEFAULT_BRAT_BASE_URL,
  nexrayBaseUrl = DEFAULT_NEXRAY_BASE_URL,
} = {}) {
  const brat = (text) => {
    const value = validateBratText(text);
    return requestMedia(`${baseUrl(bratBaseUrl)}/?text=${encodeURIComponent(value)}`);
  };

  const bratFrames = async (text) => {
    const value = validateBratText(text);
    const phrases = progressivePhrases(value);
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

  const iqc = (text) => {
    const value = String(text).trim();
    if (!value) throw new Error('Teks IQC tidak boleh kosong.');
    return requestMedia(`${baseUrl(nexrayBaseUrl)}/maker/iqc?text=${encodeURIComponent(value)}`);
  };

  return Object.freeze({ brat, bratFrames, iqc });
}
