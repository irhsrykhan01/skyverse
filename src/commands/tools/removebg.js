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
    let media;
    try {
      media = await ctx.media.download();
    } catch (error) {
      const message = String(error?.message ?? '').toLowerCase();
      if (message.includes('tidak ada media') || message.includes('reply atau kirim') || message.includes('pesan media tidak valid')) {
        await ctx.reply('Reply/Kirimkan gambarnya terlebih dahulu!');
        return;
      }
      throw error;
    }

    if (media.type !== 'image') {
      await ctx.reply('Reply/Kirimkan gambarnya terlebih dahulu!');
      return;
    }

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
