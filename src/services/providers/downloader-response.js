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

function chooseUrl(result, preferredTerms = [], extensions = []) {
  const candidates = collectUrls(result);
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, preferredTerms)
        + (extensions.some((ext) => candidate.url.toLowerCase().split('?')[0].endsWith(ext)) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.url ?? null;
}

export function findDownloaderUrls(response, { kind = 'video' } = {}) {
  const result = response?.result ?? response?.data ?? response;
  const candidates = collectUrls(result);
  const preferred = kind === 'audio'
    ? ['audio', 'mp3', 'music', 'm4a', 'audio_url', 'download_audio']
    : kind === 'image'
      ? ['images', 'image', 'photo', 'picture', 'jpg', 'png', 'webp']
      : kind === 'auto'
        ? ['video', 'mp4', 'play', 'download', 'video_url', 'no_watermark', 'images', 'image', 'photo', 'picture']
        : ['video', 'mp4', 'play', 'download', 'video_url', 'no_watermark'];
  const extensions = kind === 'audio'
    ? ['.mp3', '.m4a', '.aac', '.ogg', '.opus']
    : kind === 'image'
      ? ['.jpg', '.jpeg', '.png', '.webp']
      : ['.mp4', '.webm', '.mov', '.mkv'];
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, preferred) + (extensions.some((ext) => candidate.url.toLowerCase().split('?')[0].endsWith(ext)) ? 3 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.url);
}

export function findDownloaderUrl(response, options = {}) {
  return findDownloaderUrls(response, options)[0] ?? null;
}

function isLikelyMediaBuffer(buffer, kind) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;

  if (kind === 'image') {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      || buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      || (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP');
  }

  if (kind === 'audio') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS'
      || buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      || buffer.subarray(0, 4).toString('ascii') === 'RIFF';
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
  const result = response?.result ?? response?.data ?? response;
  const mediaItems = Array.isArray(result) ? result
    : [result?.medias, result?.items, result?.data].find(Array.isArray) ?? [];
  if (mediaItems.length) {
    for (const item of mediaItems.slice(0, 10)) {
      const url = findDownloaderUrl(item, { kind: 'auto' });
      if (!url) continue;
      const mime = String(item?.mimeType ?? item?.mimetype ?? item?.type ?? '').toLowerCase();
      const image = mime.includes('image') || /\\.(?:jpe?g|png|webp)(?:$|\\?)/i.test(url);
      const mediaKind = image ? 'image' : 'video';
      const media = await downloadUrl(url, { kind: mediaKind, maxBytes: image ? 15 * 1024 * 1024 : 30 * 1024 * 1024 });
      await ctx.media.send(media, mediaKind, { caption });
    }
    return;
  }
  const slideImages = Array.isArray(result?.images) ? result.images.filter(isMediaUrl) : [];
  if (slideImages.length) {
    for (const url of slideImages) {
      const media = await downloadUrl(url, { kind: 'image', maxBytes: 15 * 1024 * 1024 });
      await ctx.media.send(media, 'image', { caption });
    }
    return;
  }

  const urls = findDownloaderUrls(response, { kind });
  const url = urls[0];
  if (!url) {
    const errorMessage = response?.error?.message ?? response?.error ?? 'Downloader tidak mengembalikan media yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  const candidate = collectUrls(result).find((item) => item.url === url);
  const imagePath = candidate?.path.some((part) => /^(images?|photos?|pictures?)$/i.test(part));
  const mediaKind = kind === 'auto'
    ? (imagePath || /\\.(?:jpe?g|png|webp)(?:$|\\?)/i.test(url) ? 'image' : 'video')
    : kind;
  const media = await downloadUrl(url, { kind: mediaKind, maxBytes: mediaKind === 'image' ? 15 * 1024 * 1024 : 30 * 1024 * 1024 });
  if (mediaKind === 'audio') return ctx.media.send(media, 'audio', { mimetype: 'audio/mpeg', fileName: filename, caption });
  if (mediaKind === 'image') return ctx.media.send(media, 'image', { mimetype: 'image/jpeg', caption });
  return ctx.media.send(media, 'video', { mimetype: 'video/mp4', fileName: filename, caption });
}

export async function replyWithDownloaderAudio(ctx, response, { caption = null, filename = 'skyverse-audio.mp3' } = {}) {
  const url = findDownloaderUrl(response, { kind: 'audio' });
  if (!url) {
    const errorMessage = response?.error?.message ?? response?.error ?? 'Downloader tidak mengembalikan audio yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  const source = await downloadUrl(url, { maxBytes: 50 * 1024 * 1024, kind: 'audio' });
  const audio = await ctx.media.toMp3(source);
  if (!Buffer.isBuffer(audio) || audio.length < 1024 || audio.subarray(0, 3).toString('ascii') !== 'ID3') {
    throw new Error('Audio hasil konversi MP3 tidak valid.');
  }

  return ctx.media.send(audio, 'audio', {
    mimetype: 'audio/mpeg',
    fileName: filename,
    caption,
  });
}
