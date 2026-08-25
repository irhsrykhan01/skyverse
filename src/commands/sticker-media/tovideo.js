export const command = {
  name: 'tovideo',
  description: 'Mengubah sticker bergerak menjadi video MP4.',
  category: 'sticker',
  aliases: ['vid'],
  usage: 'tovideo (reply sticker bergerak)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'sticker' || !media.animated) {
      throw new Error('tovideo hanya menerima sticker bergerak.');
    }
    const output = await ctx.media.toVideo(media.buffer, { sourceType: 'sticker', animated: true });
    if (!Buffer.isBuffer(output) || output.length < 1024) throw new Error('Hasil video kosong atau terlalu kecil.');
    await ctx.media.send(output, 'video', { mimetype: 'video/mp4' });
  },
};
