import { toSmeme } from '../../services/media/ffmpeg.js';

export const command = {
  name: 'smeme',
  description: 'Membuat meme dari gambar dengan teks atas dan bawah.',
  category: 'sticker',
  aliases: [],
  usage: 'smeme teks atas | teks bawah (reply/kirim gambar)',
  examples: ['smeme halo | dunia', 'smeme | ini bagian bawah'],
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'image') throw new Error('smeme membutuhkan gambar.');
    const raw = ctx.parsed.args.join(' ');
    const [top = '', bottom = ''] = raw.split('|', 2).map((value) => value.trim());
    if (!top && !bottom) throw new Error('Gunakan format: smeme teks atas | teks bawah.');
    const output = await toSmeme(media.buffer, { top, bottom });
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg' });
  },
};
