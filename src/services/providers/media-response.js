function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isDataUrl(value) {
  return typeof value === 'string' && /^data:[^;]+;base64,/i.test(value);
}

function normalizeMediaUrl(value, baseUrl) {
  if (isHttpUrl(value) || isDataUrl(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('/')) {
    return new URL(value.trim(), `${baseUrl.replace(/\/$/, '')}/`).toString();
  }
  return null;
}

export function findMediaSource(value, { baseUrl = 'https://www.keyrafara.com' } = {}, seen = new Set()) {
  const direct = normalizeMediaUrl(value, baseUrl);
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

export async function replyWithProviderMedia(
  ctx,
  response,
  type = 'image',
  caption = null,
  options = {},
) {
  const result = response?.result ?? response;
  const source = findMediaSource(result, {
    baseUrl: options.baseUrl ?? ctx.config.keyraBaseUrl ?? 'https://www.keyrafara.com',
  });

  if (!source) {
    const errorMessage = response?.error?.message
      ?? response?.error
      ?? 'Provider tidak mengembalikan media yang dapat digunakan.';
    throw new Error(String(errorMessage));
  }

  const media = source.kind === 'data'
    ? decodeDataUrl(source.value)
    : { url: source.value };

  if (!media) throw new Error('Provider mengembalikan data media yang tidak valid.');

  if (type === 'video') {
    return ctx.socket.sendMessage(
      ctx.chatId,
      { video: media, ...(caption ? { caption } : {}) },
      { quoted: ctx.message },
    );
  }

  return ctx.socket.sendMessage(
    ctx.chatId,
    { image: media, ...(caption ? { caption } : {}) },
    { quoted: ctx.message },
  );
}
