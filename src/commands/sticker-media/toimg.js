export const command = {
  name: 'toimg',
  description: 'Mengambil frame gambar dari media secara lokal.',
  category: 'sticker-media',
  aliases: ['toimage'],
  usage: 'toimg (reply/kirim media)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video', 'document'].includes(media.type)) throw new Error('toimg membutuhkan gambar atau video.');
    const output = await ctx.media.toImage(media.buffer);
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg' });
  },
};
