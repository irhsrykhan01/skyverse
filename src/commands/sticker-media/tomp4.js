import { toMp4 } from '../../services/media/ffmpeg.js';

function sourceType(media) {
  if (media.type === 'image') return 'image';
  if (media.type === 'video') return 'video';
  if (media.type === 'document' && /^image\//i.test(media.mimetype ?? '')) return 'image';
  if (media.type === 'document' && /^video\//i.test(media.mimetype ?? '')) return 'video';
  return null;
}

export const command = {
  name: 'tomp4',
  description: 'Mengubah gambar atau video menjadi MP4 secara lokal.',
  category: 'sticker',
  aliases: ['mp4'],
  usage: 'tomp4 (reply/kirim gambar atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    const type = sourceType(media);
    if (!type) throw new Error('tomp4 membutuhkan gambar atau video.');
    const output = await toMp4(media.buffer, {
      sourceType: type,
      maxDuration: 60,
      imageDuration: 3,
    });
    if (!Buffer.isBuffer(output) || output.length < 1024) {
      throw new Error('Hasil MP4 kosong atau terlalu kecil.');
    }
    await ctx.media.send(output, 'video', {
      mimetype: 'video/mp4',
      caption: 'Converted by SkyVerse',
    });
  },
};
