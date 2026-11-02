import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';

import { Buffer } from 'node:buffer';

export const command = {
  name: 'brathd',
  description: 'Mengubah hasil Brat dari API menjadi sticker.',
  category: 'sticker',
  aliases: ['brat2x'],
  usage: 'brathd <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 4000,
  limitCost: 1,
  async execute(ctx) {
    const response = await ctx.providers.makers.brat(ctx.parsed.argumentText);
    const source = Buffer.isBuffer(response) ? null : findMediaSource(response?.result ?? response, { baseUrl: ctx.config.delineBaseUrl });
    if (!Buffer.isBuffer(response) && !source) throw new Error('Maker API tidak mengembalikan gambar Brat.');
    const input = Buffer.isBuffer(response) ? response : await downloadMediaSource(source, { expectedType: 'image' });
    const sticker = await ctx.media.toSticker(input);
    await ctx.socket.sendMessage(ctx.chatId, { sticker }, { quoted: ctx.message });
  },
};
