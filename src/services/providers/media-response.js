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

export async function downloadMediaSource(source, { maxBytes = 12 * 1024 * 1024 } = {}) {
  if (source.kind === 'buffer') {
    if (source.value.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
    return source.value;
  }

  if (source.kind === 'data') {
    const buffer = decodeDataUrl(source.value);
    if (!buffer) throw new Error('Provider mengembalikan data media yang tidak valid.');
    if (buffer.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
    return buffer;
  }

  const response = await fetch(source.value, {
    headers: { accept: 'image/*, video/*, audio/*, */*' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Gagal mengambil media provider (${response.status}).`);

  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error('Media dari provider terlalu besar untuk diproses.');
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

  const media = await downloadMediaSource(source);
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
