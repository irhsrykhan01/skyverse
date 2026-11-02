export const command = {
  name: 'balance',
  description: 'Melihat saldo Coin dan Limit.',
  category: 'general',
  aliases: ['bal'],
  usage: 'balance',
  permission: 'user',
  async execute(ctx) {
    const wallet = ctx.repositories.economy.get(ctx.senderJid);
    if (!wallet) throw new Error('Data pengguna tidak ditemukan. Coba jalankan command lagi.');
    await ctx.reply([
      '💳 *SKYVERSE WALLET*',
      '',
      `🪙 Coin  : ${wallet.coins.toLocaleString('id-ID')}`,
      `⚡ Limit : ${wallet.limits.toLocaleString('id-ID')}`,
    ].join('\\n'));
  },
};
