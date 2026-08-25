export const command = {
  name: 'removebg',
  description: 'Menghapus background gambar menggunakan ClearBackdrop.',
  category: 'tools',
  aliases: ['rmbg'],
  usage: 'removebg (reply/kirim gambar)',
  examples: ['removebg'],
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'image') throw new Error('RemoveBG hanya mendukung gambar.');

    const result = await ctx.providers.removebg.remove(media.buffer, {
      filename: 'skyverse-input.jpg',
      mimeType: media.message?.message?.imageMessage?.mimetype ?? 'image/jpeg',
    });

    await ctx.media.send(result, 'image', {
      mimetype: 'image/png',
      caption: 'Background berhasil dihapus oleh SkyVerse.',
    });
  },
};
