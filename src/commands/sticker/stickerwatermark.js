import { toStickerWatermark } from '../../services/media/ffmpeg.js';

export const command = {
  name: 'stickerwatermark',
  description: 'Menambahkan watermark teks pada sticker.',
  category: 'sticker',
  aliases: [],
  usage: 'stickerwatermark <teks> (reply sticker)',
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'sticker') throw new Error('Reply sticker yang ingin diberi watermark.');
    const text = ctx.parsed.args.join(' ').trim();
    const output = await toStickerWatermark(media.buffer, { text });
    await ctx.media.send(output, 'sticker');
  },
};
