import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';

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
    const source = findMediaSource(response?.result ?? response, { baseUrl: ctx.config.delineBaseUrl });
    if (!source) throw new Error('Maker API tidak mengembalikan gambar Brat.');
    const input = await downloadMediaSource(source, { expectedType: 'image' });
    const sticker = await ctx.media.toSticker(input);
    await ctx.socket.sendMessage(ctx.chatId, { sticker }, { quoted: ctx.message });
  },
};
