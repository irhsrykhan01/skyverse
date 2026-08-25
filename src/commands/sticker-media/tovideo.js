export const command = {
  name: 'tovideo',
  description: 'Mengubah gambar, sticker statis/bergerak, atau video menjadi video MP4.',
  category: 'sticker',
  aliases: ['vid'],
  usage: 'tovideo (reply/kirim gambar, sticker, atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video', 'sticker', 'document'].includes(media.type)) {
      throw new Error('tovideo membutuhkan gambar, sticker, atau video.');
    }
    const stickerMessage = media.message?.message?.stickerMessage;
    const animated = Boolean(stickerMessage?.isAnimated);
    const output = await ctx.media.toVideo(media.buffer, { sourceType: media.type, animated });
    await ctx.media.send(output, 'video', { mimetype: 'video/mp4' });
  },
};
