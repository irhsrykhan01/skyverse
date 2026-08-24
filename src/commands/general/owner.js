export const command = {
  name: 'owner',
  description: 'Menampilkan kontak pemilik SkyVerse.',
  category: 'general',
  aliases: ['creator'],
  permission: 'user',
  async execute(ctx) {
    if (!ctx.config.ownerNumber) {
      await ctx.reply('Owner belum dikonfigurasi. Isi OWNER_NUMBER pada environment SkyVerse.');
      return;
    }

    const number = ctx.config.ownerNumber.replace(/\D/g, '');
    await ctx.reply(`Owner SkyVerse: +${number}`);
  },
};
