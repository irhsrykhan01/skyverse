export function splitFields(text, count) {
  const parts = String(text ?? '').split('|').map((part) => part.trim());
  while (parts.length < count) parts.push('');
  return parts.slice(0, count);
}

export async function sendApiImage(ctx, result, caption = 'DEMO / PARODY — dibuat oleh API pihak ketiga.') {
  if (!result?.buffer || !Buffer.isBuffer(result.buffer) || !result.mimetype) {
    throw new Error('API maker tidak menghasilkan file gambar yang valid.');
  }
  await ctx.media.send(result.buffer, 'image', {
    mimetype: result.mimetype,
    caption,
  });
}
