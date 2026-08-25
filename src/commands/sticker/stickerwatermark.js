import { toStickerWatermark } from '../../services/media/ffmpeg.js';

export const command = {
  name: 'stickerwatermark',
  description: 'Mengubah watermark teks pada sticker.',
  category: 'sticker',
  aliases: ['swm'],
  usage: 'stickerwatermark <teks> (reply sticker)',
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const text = ctx.parsed.args.join(' ').trim();
    if (!text) throw new Error('Masukkan teks watermark. Contoh: stickerwatermark SkyVerse');

    const media = await ctx.media.download();
    if (media.type !== 'sticker') {
      throw new Error('Reply sticker yang ingin diberi watermark.');
    }

    await ctx.react('⏳');
    try {
      const output = await toStickerWatermark(media.buffer, { text });
      await ctx.media.send(output, 'sticker');
      await ctx.react('☑️');
    } catch (error) {
      await ctx.react('❌');
      throw error;
    }
  },
};
