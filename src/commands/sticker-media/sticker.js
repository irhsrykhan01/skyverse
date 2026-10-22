export const command = {
  name: 'sticker',
  description: 'Mengubah gambar, video, GIF, atau sticker menjadi sticker.',
  category: 'sticker',
  aliases: ['s'],
  usage: 'sticker (reply/kirim media)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();

    if (!['image', 'video', 'sticker'].includes(media.type)) {
      throw new Error('Sticker hanya mendukung gambar, video, GIF, atau sticker.');
    }

    const output = media.type === 'video'
      ? await ctx.media.toAnimatedSticker(media.buffer)
      : await ctx.media.toSticker(media.buffer);

    await ctx.media.send(output, 'sticker');
  },
};
