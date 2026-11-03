export const command = {
  name: 'coin',
  description: 'Melihat saldo Coin kamu.',
  category: 'economy',
  aliases: ['bal'],
  usage: 'coin',
  permission: 'user',
  async execute(ctx) {
    const wallet = ctx.repositories.economy.get(ctx.senderJid);
    if (!wallet) throw new Error('Data pengguna tidak ditemukan. Coba jalankan command lagi.');
    await ctx.reply('🪙 *SALDO COIN*\n\\n' + wallet.coins.toLocaleString('id-ID') + ' Coin');
  },
};
