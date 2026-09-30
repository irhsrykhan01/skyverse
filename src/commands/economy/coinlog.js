import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'coinlog',
  description: 'Melihat riwayat transaksi Coin terbaru.',
  category: 'economy',
  access: 'npc',
  aliases: ['coinhistory', 'transactions'],
  usage: 'coinlog',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    const rows = ctx.economy.history(ctx.senderJid, 10);
    if (!rows.length) {
      await ctx.reply('Belum ada riwayat transaksi Coin.');
      return;
    }

    const lines = rows.map((row, index) => {
      const sign = row.type === 'credit' || row.type === 'transfer_in' ? '+' : '-';
      const when = new Date(Number(row.created_at) || 0).toLocaleString('id-ID');
      return `${index + 1}. ${sign}${formatCoins(row.amount)} 🪙 • ${row.reason || row.type} • ${when}`;
    });

    await ctx.reply(['📜 *COIN HISTORY*', '', ...lines].join('\n'));
  },
};
