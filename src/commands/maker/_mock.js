import { renderMockUi } from '../../services/mock-ui.js';

export function splitFields(text, count) {
  const parts = String(text ?? '').split('|').map((part) => part.trim());
  while (parts.length < count) parts.push('');
  return parts;
}

export async function sendMock(ctx, payload) {
  const image = renderMockUi(payload);
  await ctx.media.send(image, 'image', {
    mimetype: 'image/png',
    caption: 'DEMO / PARODY — bukan tampilan asli.',
  });
}
