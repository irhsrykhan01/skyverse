export const command = {
  name: 'coin',
  description: 'Melihat saldo Coin kamu.',
  category: 'general',
  aliases: ['bal'],
  usage: 'coin',
  permission: 'user',
  async execute(ctx) {
    const wallet = ctx.repositories.economy.get(ctx.senderJid);
    if (!wallet) throw new Error('Data pengguna tidak ditemukan. Coba jalankan command lagi.');
    await ctx.reply(ctx.isOwner
      ? '🪙 *SALDO COIN*\n\nUnlimited (Owner)'
      : '🪙 *SALDO COIN*\n\n' + wallet.coins.toLocaleString('id-ID') + ' Coin');
  },
};
