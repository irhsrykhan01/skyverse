const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm', '.mkv'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'];
const EXCLUDED_KEYS = ['avatar', 'cover', 'thumbnail', 'thumb', 'profile', 'poster', 'logo', 'image'];

function collectUrls(value, path = [], output = [], seen = new Set()) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    output.push({ url: value, path });
    return output;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return output;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUrls(item, [...path, String(index)], output, seen));
  } else {
    for (const [key, child] of Object.entries(value)) {
      collectUrls(child, [...path, key.toLowerCase()], output, seen);
    }
  }
  return output;
}

function scoreCandidate(candidate, kind) {
  const path = candidate.path;
  if (path.some((part) => EXCLUDED_KEYS.some((key) => part.includes(key)))) return -Infinity;
  const fields = path.join(' ');
  const cleanUrl = candidate.url.toLowerCase().split(/[?#]/, 1)[0];
  const expected = kind === 'audio' ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;
  const opposite = kind === 'audio' ? VIDEO_EXTENSIONS : AUDIO_EXTENSIONS;
  if (opposite.some((ext) => cleanUrl.endsWith(ext))) return -Infinity;
  const terms = kind === 'audio'
    ? [['audio_url', 40], ['download_audio', 35], ['audio', 24], ['mp3', 22], ['m4a', 18], ['music', 8]]
    : [['no_watermark', 40], ['download_url', 36], ['video_url', 34], ['play', 26], ['video', 22], ['mp4', 18], ['download', 12], ['stream', 10]];
  let score = terms.reduce((sum, [term, weight]) => sum + (fields.includes(term) ? weight : 0), 0);
  if (path.at(-1) === 'url') score += 3;
  if (expected.some((ext) => cleanUrl.endsWith(ext))) score += 30;
  return score;
}

export function findDownloaderUrls(response, { kind = 'video' } = {}) {
  const candidates = collectUrls(response)
    .map((item) => ({ ...item, score: scoreCandidate(item, kind) }))
    .filter((item) => Number.isFinite(item.score) && item.score > 0)
    .sort((a, b) => b.score - a.score);
  return [...new Set(candidates.map((item) => item.url))];
}

export function findDownloaderUrl(response, options = {}) {
  return findDownloaderUrls(response, options)[0] ?? null;
}

export function isLikelyMediaBuffer(buffer, kind = 'video') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  if (kind === 'audio') {
    return buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      || buffer.subarray(0, 4).toString('ascii') === 'OggS'
      || (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE')
      || buffer.subarray(0, 4).toString('ascii') === 'fLaC'
      || buffer.subarray(4, 8).toString('ascii') === 'ftyp'
      || (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0);
  }
  return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    || buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    || buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

function retryable(error) {
  const status = Number(error?.status ?? 0);
  return [408, 425, 429].includes(status) || status >= 500
    || ['AbortError', 'TimeoutError'].includes(error?.name)
    || /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message ?? ''));
}

async function readLimited(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('Media provider terlalu besar untuk dikirim.');
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
        throw new Error('Media provider terlalu besar untuk dikirim.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

export async function downloadUrl(url, { maxBytes = 60 * 1024 * 1024, retries = 1, kind = 'video' } = {}) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('URL media provider tidak valid.');
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const parsed = new URL(url);
      const response = await fetch(url, {
        headers: {
          accept: 'image/*, video/*, audio/*, application/octet-stream;q=0.9, */*;q=0.5',
          'user-agent': 'Mozilla/5.0 (compatible; SkyVerse/1.0; +https://github.com/irhsrykhan01/skyverse)',
          ...(parsed.hostname.toLowerCase().includes('tiktokcdn') ? { referer: 'https://www.tiktok.com/' } : {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(35_000),
      });
      if (!response.ok) {
        const error = new Error('Gagal mengambil media provider (HTTP ' + response.status + ').');
        error.status = response.status;
        throw error;
      }
      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
      if (/^(text\/|application\/(json|javascript|xml))/.test(contentType)) {
        throw new Error('Provider mengembalikan ' + (contentType || 'konten teks') + ', bukan file media.');
      }
      if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
        throw new Error('Media provider terlalu besar untuk dikirim.');
      }
      const buffer = await readLimited(response, maxBytes);
      if (!buffer.length) throw new Error('Provider mengembalikan media kosong.');
      if (!isLikelyMediaBuffer(buffer, kind)) throw new Error('Provider tidak mengembalikan file ' + kind + ' yang valid.');
      return buffer;
    } catch (error) {
      lastError = error;
      if (!retryable(error) || attempt >= retries) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error('Gagal mengambil media provider.');
}

function getDirectMedia(response) {
  if (Buffer.isBuffer(response)) return response;
  if (Buffer.isBuffer(response?.media)) return response.media;
  if (Buffer.isBuffer(response?.result?.media)) return response.result.media;
  return null;
}

export async function downloadMediaFromResponse(response, { kind = 'video', maxBytes } = {}) {
  const direct = getDirectMedia(response);
  const limit = maxBytes ?? (kind === 'audio' ? 50 : 60) * 1024 * 1024;
  if (direct) {
    if (direct.length > limit) throw new Error('Media provider terlalu besar untuk dikirim.');
    if (!isLikelyMediaBuffer(direct, kind)) throw new Error('Provider tidak mengembalikan file ' + kind + ' yang valid.');
    return direct;
  }
  const urls = findDownloaderUrls(response, { kind });
  if (!urls.length) {
    const message = response?.error?.message ?? response?.error ?? response?.message;
    throw new Error(String(message ?? ('Provider tidak mengembalikan URL ' + kind + ' yang dapat digunakan.')));
  }
  const failures = [];
  for (const url of urls) {
    try {
      return await downloadUrl(url, { kind, maxBytes: limit });
    } catch (error) {
      failures.push(error?.message ?? String(error));
    }
  }
  throw new Error('Semua URL media dari provider gagal: ' + failures.join(' | '));
}

function formatFailure(provider, error) {
  const message = String(error?.message ?? error ?? 'Unknown error').replace(/\s+/g, ' ').trim();
  return provider.name + ': ' + message.slice(0, 220);
}

export async function downloadWithProviderFallback(providers, url, options = {}) {
  const requestedKind = options.kind ?? 'video';
  const kinds = requestedKind === 'audio' && options.fallbackToVideo ? ['audio', 'video'] : [requestedKind];
  const failures = [];
  for (const provider of providers) {
    try {
      const response = await provider.execute(url);
      let mediaError = null;
      for (const kind of kinds) {
        try {
          const buffer = await (options.downloadResponse ?? downloadMediaFromResponse)(response, {
            kind,
            maxBytes: options.maxBytes,
          });
          return Object.freeze({ buffer, mediaKind: kind, requestedKind, provider: provider.name, response });
        } catch (error) {
          mediaError = error;
        }
      }
      throw mediaError ?? new Error('Provider tidak memberikan media yang dapat dipakai.');
    } catch (error) {
      failures.push(formatFailure(provider, error));
    }
  }
  const message = failures.length ? failures.join(' | ') : 'Tidak ada provider yang dikonfigurasi.';
  const error = new Error('Semua provider TikTok gagal: ' + message);
  error.providers = failures;
  throw error;
}

export async function replyWithDownloaderMedia(ctx, response, { kind = 'video', caption = null, filename = null } = {}) {
  const media = await downloadMediaFromResponse(response, { kind });
  return ctx.media.send(media, kind, {
    mimetype: kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
    ...(filename ? { fileName: filename } : {}),
    ...(caption ? { caption } : {}),
  });
}

export async function replyWithDownloaderAudio(ctx, response, { caption = null, filename = 'skyverse-audio.mp3' } = {}) {
  const source = await downloadMediaFromResponse(response, { kind: 'audio', maxBytes: 50 * 1024 * 1024 });
  const audio = await ctx.media.toMp3(source);
  if (!Buffer.isBuffer(audio) || audio.length < 1024) throw new Error('Audio hasil konversi MP3 tidak valid.');
  return ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: filename, caption });
}
