export const command = {
  name: 'limit',
  description: 'Melihat sisa Limit untuk fitur SkyVerse.',
  category: 'economy',
  aliases: [],
  usage: 'limit',
  permission: 'user',
  async execute(ctx) {
    const wallet = ctx.repositories.economy.get(ctx.senderJid);
    if (!wallet) throw new Error('Data pengguna tidak ditemukan. Coba jalankan command lagi.');
    await ctx.reply(`⚡ *SISA LIMIT*\n\n${wallet.limits.toLocaleString('id-ID')} Limit`);
  },
};
