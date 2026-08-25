export const command = {
  name: 'toimg',
  description: 'Mengubah gambar, video, atau sticker menjadi gambar JPEG.',
  category: 'sticker',
  aliases: ['toimage'],
  usage: 'toimg (reply/kirim gambar, video, atau sticker)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video', 'sticker', 'document'].includes(media.type)) {
      throw new Error('toimg membutuhkan gambar, video, atau sticker.');
    }
    const output = await ctx.media.toImage(media.buffer);
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg' });
  },
};
