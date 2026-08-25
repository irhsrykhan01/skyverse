export const command = {
  name: 'tovideo',
  description: 'Mengubah media menjadi video MP4 secara lokal.',
  category: 'sticker-media',
  aliases: ['vid'],
  usage: 'tovideo (reply/kirim media)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video', 'document'].includes(media.type)) throw new Error('tovideo membutuhkan gambar atau video.');
    const output = await ctx.media.toVideo(media.buffer);
    await ctx.media.send(output, 'video', { mimetype: 'video/mp4' });
  },
};
