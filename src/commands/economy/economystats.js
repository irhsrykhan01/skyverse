export const command = {
  name: 'economystats',
  description: 'Melihat statistik ekonomi SkyVerse dan statistik akun kamu.',
  category: 'economy',
  aliases: ['estats'],
  permission: 'user',
  usage: 'economystats',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    const stats = ctx.repositories.economy.getEconomyStats(ctx.senderJid);
    const global = stats.global || {};
    const personal = stats.personal || {};
    const wallet = stats.wallet || { coins: 0, limits: 0 };

    await ctx.reply([
      '📊 *SKYVERSE ECONOMY STATS*',
      '',
      '*Ekonomi Global*',
      '👥 Wallet: ' + Number(global.wallet_count || 0).toLocaleString('id-ID'),
      '🪙 Coin beredar: ' + Number(global.coin_circulation || 0).toLocaleString('id-ID'),
      '⚡ Limit beredar: ' + Number(global.limit_circulation || 0).toLocaleString('id-ID'),
      '📥 Total Coin masuk: ' + Number(global.coin_earned || 0).toLocaleString('id-ID'),
      '📤 Total Coin terpakai: ' + Number(global.coin_spent || 0).toLocaleString('id-ID'),
      '🎮 Hadiah game: ' + Number(global.game_rewards || 0).toLocaleString('id-ID') + ' Coin',
      '🎁 Klaim Daily: ' + Number(global.daily_claims || 0),
      '🧾 Total transaksi: ' + Number(global.transaction_count || 0).toLocaleString('id-ID'),
      '',
      '*Statistik Akun Kamu*',
      '🪙 Saldo: ' + wallet.coins.toLocaleString('id-ID') + ' Coin',
      '⚡ Limit: ' + wallet.limits.toLocaleString('id-ID'),
      '📥 Coin diperoleh: ' + Number(personal.coin_earned || 0).toLocaleString('id-ID'),
      '📤 Coin terpakai: ' + Number(personal.coin_spent || 0).toLocaleString('id-ID'),
      '🎮 Hadiah game: ' + Number(personal.game_rewards || 0).toLocaleString('id-ID') + ' Coin',
      '🎁 Daily diklaim: ' + Number(personal.daily_claims || 0),
      '🛒 Pembelian Limit: ' + Number(personal.limit_purchases || 0),
      '🧾 Transaksi: ' + Number(personal.transaction_count || 0),
    ].join('\n'));
  },
};
