const PACKAGES = Object.freeze({
  5: { amount: 5, cost: 250 },
  10: { amount: 10, cost: 450 },
  25: { amount: 25, cost: 1000 },
});

function formatPackages(prefix) {
  return [
    '🛒 *SKYVERSE LIMIT SHOP*',
    '',
    'Pilih paket yang ingin dibeli:',
    '• 5 Limit — 250 Coin',
    '• 10 Limit — 450 Coin',
    '• 25 Limit — 1.000 Coin',
    '',
    'Cara membeli: ' + prefix + 'limitshop <jumlah>',
    'Contoh: ' + prefix + 'limitshop 10',
  ].join('\n');
}

export const command = {
  name: 'limitshop',
  description: 'Membeli Limit menggunakan Coin.',
  category: 'general',
  aliases: ['shoplimit'],
  permission: 'user',
  usage: 'limitshop [5|10|25]',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    if (ctx.isOwner) {
      await ctx.reply('👑 Owner sudah memiliki akses Limit unlimited dan tidak perlu membeli paket.');
      return;
    }

    const requested = ctx.parsed.args[0];
    if (!requested) {
      await ctx.reply(formatPackages(ctx.config.prefix));
      return;
    }

    const pack = PACKAGES[Number(requested)];
    if (!pack || String(pack.amount) !== String(requested)) {
      await ctx.reply('Paket tidak tersedia. Pilih 5, 10, atau 25 Limit.');
      return;
    }

    const result = ctx.repositories.economy.purchaseLimits(
      ctx.senderJid,
      pack.amount,
      pack.cost,
    );

    if (!result.ok) {
      if (result.reason === 'insufficient_funds') {
        await ctx.reply(
          'Coin kamu belum cukup. Harga paket ini ' + pack.cost.toLocaleString('id-ID')
            + ' Coin, sedangkan saldo kamu ' + Number(result.coins || 0).toLocaleString('id-ID') + ' Coin.',
        );
        return;
      }
      throw new Error('Pembelian Limit gagal diproses. Coba lagi nanti.');
    }

    await ctx.reply([
      '✅ *PEMBELIAN BERHASIL!*',
      '',
      '⚡ Limit diterima: +' + result.amount.toLocaleString('id-ID'),
      '🪙 Coin terpakai: -' + result.cost.toLocaleString('id-ID'),
      '',
      '🪙 Sisa Coin: ' + result.coins.toLocaleString('id-ID'),
      '⚡ Total Limit: ' + result.limits.toLocaleString('id-ID'),
    ].join('\n'));
  },
};
