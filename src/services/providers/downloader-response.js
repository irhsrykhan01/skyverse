function isMediaUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function collectUrls(value, path = [], output = [], seen = new Set()) {
  if (isMediaUrl(value)) {
    output.push({ url: value, path });
    return output;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return output;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUrls(item, [...path, String(index)], output, seen));
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    collectUrls(child, [...path, key.toLowerCase()], output, seen);
  }
  return output;
}

function scoreCandidate(candidate, preferredTerms = []) {
  const haystack = candidate.path.join(' ').toLowerCase();
  return preferredTerms.reduce((score, term, index) => (
    haystack.includes(term.toLowerCase()) ? score + (preferredTerms.length - index) : score
  ), 0);
}

function chooseUrls(result, preferredTerms = [], extensions = []) {
  const candidates = collectUrls(result);
  const ranked = candidates
    .map((candidate, index) => ({
      ...candidate,
      index,
      score: scoreCandidate(candidate, preferredTerms)
        + (extensions.some((ext) => candidate.url.toLowerCase().split('?')[0].endsWith(ext)) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return [...new Set(ranked.map((candidate) => candidate.url))];
}

export function findDownloaderUrls(response, { kind = 'video' } = {}) {
  const result = response?.result ?? response;
  const preferred = kind === 'audio'
    ? ['audio', 'mp3', 'music', 'm4a', 'audio_url', 'download_audio']
    : kind === 'image'
      ? ['image', 'images', 'photo', 'picture', 'jpg', 'jpeg', 'png']
      : ['video', 'mp4', 'play', 'download', 'video_url', 'no_watermark'];
  const extensions = kind === 'audio'
    ? ['.mp3', '.m4a', '.aac', '.ogg', '.opus']
    : kind === 'image'
      ? ['.jpg', '.jpeg', '.png', '.webp']
      : ['.mp4', '.webm', '.mov', '.mkv'];
  return chooseUrls(result, preferred, extensions);
}

export function findDownloaderUrl(response, options = {}) {
  return findDownloaderUrls(response, options)[0] ?? null;
}

function isLikelyMediaBuffer(buffer, kind) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;

  if (kind === 'audio') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS'
      || buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      || buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  }

  if (kind === 'image') {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      || buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      || (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP');
  }

  return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    || buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    || buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

async function downloadUrl(url, { maxBytes = 30 * 1024 * 1024, retries = 2, kind = 'video' } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/*, video/*, audio/*, */*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        const error = new Error(`Gagal mengambil media provider (${response.status}).`);
        error.status = response.status;
        if (![408, 425, 429].includes(response.status) && response.status < 500) throw error;
        throw error;
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > maxBytes) throw new Error('Media provider terlalu besar untuk dikirim.');

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error('Provider mengembalikan media kosong.');
      if (buffer.length > maxBytes) throw new Error('Media provider terlalu besar untuk dikirim.');
      if (!isLikelyMediaBuffer(buffer, kind)) {
        throw new Error('Provider tidak mengembalikan file media yang valid.');
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Gagal mengambil media provider.');
}

export async function replyWithDownloaderMedia(ctx, response, { kind = 'video', caption = null, filename = null } = {}) {
  const urls = findDownloaderUrls(response, { kind });
  if (!urls.length) {
    const errorMessage = response?.error?.message ?? response?.error ?? 'Downloader tidak mengembalikan media yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  let lastError = null;
  for (const url of urls.slice(0, 6)) {
    try {
      const media = await downloadUrl(url, { kind });
      const content = kind === 'audio'
        ? { audio: media, mimetype: 'audio/mpeg', ...(filename ? { fileName: filename } : {}), ...(caption ? { caption } : {}) }
        : kind === 'image'
          ? { image: media, ...(caption ? { caption } : {}) }
          : { video: media, ...(filename ? { fileName: filename } : {}), ...(caption ? { caption } : {}) };
      return await ctx.socket.sendMessage(ctx.chatId, content, { quoted: ctx.message });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Semua kandidat media dari provider gagal dimuat.');
}

export async function replyWithDownloaderAudio(ctx, response, { caption = null, filename = 'skyverse-audio.mp3' } = {}) {
  const urls = findDownloaderUrls(response, { kind: 'audio' });
  if (!urls.length) {
    const errorMessage = response?.error?.message ?? response?.error ?? 'Downloader tidak mengembalikan audio yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  let lastError = null;
  for (const url of urls.slice(0, 6)) {
    try {
      const source = await downloadUrl(url, { maxBytes: 50 * 1024 * 1024, kind: 'audio' });
      const audio = await ctx.media.toMp3(source);
      if (!Buffer.isBuffer(audio) || audio.length < 1024 || audio.subarray(0, 3).toString('ascii') !== 'ID3') {
        throw new Error('Audio hasil konversi MP3 tidak valid.');
      }

      return await ctx.media.send(audio, 'audio', {
        mimetype: 'audio/mpeg',
        fileName: filename,
        caption,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Semua kandidat audio dari provider gagal dimuat.');
}
