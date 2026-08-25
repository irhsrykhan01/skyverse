export const command = {
  name: 'sticker',
  description: 'Mengubah gambar/video menjadi sticker secara lokal.',
  category: 'sticker-media',
  aliases: ['s'],
  usage: 'sticker (reply/kirim gambar atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video'].includes(media.type)) throw new Error('Sticker hanya mendukung gambar atau video.');
    const output = media.type === 'video' ? await ctx.media.toAnimatedSticker(media.buffer) : await ctx.media.toSticker(media.buffer);
    await ctx.media.send(output, 'sticker');
  },
};
