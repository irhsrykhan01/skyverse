function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isDataUrl(value) {
  return typeof value === 'string' && /^data:[^;]+;base64,/i.test(value);
}

function normalizeMediaSource(value, baseUrl) {
  if (isHttpUrl(value) || isDataUrl(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('/')) {
    return new URL(value.trim(), `${baseUrl.replace(/\/$/, '')}/`).toString();
  }
  return null;
}

export function findMediaSource(value, { baseUrl = 'https://www.keyrafara.com' } = {}, seen = new Set()) {
  if (Buffer.isBuffer(value)) return { kind: 'buffer', value };

  const direct = normalizeMediaSource(value, baseUrl);
  if (direct) return { kind: direct.startsWith('data:') ? 'data' : 'url', value: direct };

  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMediaSource(item, { baseUrl }, seen);
      if (found) return found;
    }
    return null;
  }

  const preferredKeys = [
    'url', 'image', 'imageUrl', 'image_url', 'video', 'videoUrl', 'video_url',
    'media', 'mediaUrl', 'media_url', 'download', 'downloadUrl', 'download_url',
    'file', 'fileUrl', 'file_url', 'output', 'result', 'data',
  ];

  for (const key of preferredKeys) {
    const found = findMediaSource(value[key], { baseUrl }, seen);
    if (found) return found;
  }

  for (const child of Object.values(value)) {
    const found = findMediaSource(child, { baseUrl }, seen);
    if (found) return found;
  }

  return null;
}

function decodeDataUrl(value) {
  const match = /^data:[^;]+;base64,(.+)$/is.exec(value);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function likelyMediaBuffer(buffer, expectedType, contentType = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  const mime = String(contentType).toLowerCase();
  if (/text\\/(html|plain)|application\\/(json|javascript)/i.test(mime)) return false;

  if (expectedType === 'image') {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      || buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      || (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
      || mime.startsWith('image/');
  }

  if (expectedType === 'video') {
    return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
      || buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      || buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      || mime.startsWith('video/');
  }

  return true;
}

export async function downloadMediaSource(source, { maxBytes = 12 * 1024 * 1024, expectedType = null } = {}) {
  if (source.kind === 'buffer') {
    if (source.value.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
    if (!likelyMediaBuffer(source.value, expectedType)) throw new Error('Provider mengembalikan media yang tidak valid.');
    return source.value;
  }

  if (source.kind === 'data') {
    const buffer = decodeDataUrl(source.value);
    if (!buffer) throw new Error('Provider mengembalikan data media yang tidak valid.');
    if (buffer.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
    const mime = String(source.value).match(/^data:([^;]+);/i)?.[1] ?? '';
    if (!likelyMediaBuffer(buffer, expectedType, mime)) throw new Error('Provider mengembalikan media yang tidak valid.');
    return buffer;
  }

  const response = await fetch(source.value, {
    headers: { accept: 'image/*, video/*, audio/*, */*' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Gagal mengambil media provider (${response.status}).`);

  const contentType = response.headers.get('content-type') ?? '';
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
  if (!likelyMediaBuffer(buffer, expectedType, contentType)) {
    throw new Error('Provider tidak mengembalikan file media yang valid.');
  }
  return buffer;
}

function getProviderBaseUrl(ctx, options = {}) {
  return options.baseUrl
    ?? ctx.config.depayBaseUrl
    ?? ctx.config.keyraBaseUrl
    ?? 'https://www.keyrafara.com';
}

export async function replyWithProviderMedia(ctx, response, type = 'image', caption = null, options = {}) {
  const result = response?.result ?? response;
  const source = findMediaSource(result, { baseUrl: getProviderBaseUrl(ctx, options) });

  if (!source) {
    const errorMessage = response?.error?.message
      ?? response?.error
      ?? response?.message
      ?? 'Provider tidak mengembalikan media yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  const media = await downloadMediaSource(source, { expectedType: type });
  const content = type === 'video'
    ? { video: media, ...(caption ? { caption } : {}) }
    : { image: media, ...(caption ? { caption } : {}) };

  return ctx.socket.sendMessage(ctx.chatId, content, { quoted: ctx.message });
}

export async function replyWithProviderSticker(ctx, response, { animated = false, baseUrl } = {}) {
  const result = response?.result ?? response;
  const source = findMediaSource(result, {
    baseUrl: baseUrl ?? ctx.config.depayBaseUrl ?? ctx.config.keyraBaseUrl ?? 'https://www.keyrafara.com',
  });

  if (!source) {
    const errorMessage = response?.error?.message
      ?? response?.error
      ?? response?.message
      ?? 'Provider tidak mengembalikan gambar/video untuk sticker.';
    throw new Error(String(errorMessage));
  }

  const input = await downloadMediaSource(source, {
    maxBytes: animated ? 20 * 1024 * 1024 : 12 * 1024 * 1024,
    expectedType: 'image',
  });
  const sticker = animated
    ? await ctx.media.toAnimatedSticker(input)
    : await ctx.media.toSticker(input);

  return ctx.socket.sendMessage(
    ctx.chatId,
    { sticker },
    { quoted: ctx.message },
  );
}
