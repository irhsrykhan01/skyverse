export const command = {
  name: 'tomp4',
  description: 'Mengubah video/media menjadi MP4 secara lokal.',
  category: 'sticker-media',
  aliases: ['mp4'],
  usage: 'tomp4 (reply/kirim media)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video', 'document'].includes(media.type)) throw new Error('tomp4 membutuhkan gambar, video, atau file media.');
    const output = await ctx.media.toVideo(media.buffer);
    await ctx.media.send(output, 'video', { mimetype: 'video/mp4', caption: 'Converted by SkyVerse' });
  },
};
