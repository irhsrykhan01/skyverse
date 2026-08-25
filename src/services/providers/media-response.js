function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function findMediaUrl(value, seen = new Set()) {
  if (isHttpUrl(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMediaUrl(item, seen);
      if (found) return found;
    }
    return null;
  }

  const preferredKeys = ['url', 'imageUrl', 'image_url', 'videoUrl', 'video_url', 'mediaUrl', 'media_url', 'downloadUrl', 'download_url'];
  for (const key of preferredKeys) {
    const found = findMediaUrl(value[key], seen);
    if (found) return found;
  }

  for (const child of Object.values(value)) {
    const found = findMediaUrl(child, seen);
    if (found) return found;
  }
  return null;
}

export async function replyWithProviderMedia(ctx, response, type = 'image', caption = null) {
  const result = response?.result ?? response;
  const url = findMediaUrl(result);
  if (!url) {
    const error = response?.error ?? 'Provider tidak mengembalikan URL media.';
    throw new Error(String(error));
  }

  const content = type === 'video' ? { video: { url }, ...(caption ? { caption } : {}) } : { image: { url }, ...(caption ? { caption } : {}) };
  return ctx.socket.sendMessage(ctx.chatId, content, { quoted: ctx.message });
}
