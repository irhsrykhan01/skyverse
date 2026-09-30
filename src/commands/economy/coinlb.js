import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'coinlb',
  description: 'Menampilkan leaderboard Coin.',
  category: 'economy',
  access: 'npc',
  aliases: ['coinleaderboard', 'rich'],
  usage: 'coinlb',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  cost: 0,
  async execute(ctx) {
    const rows = ctx.economy.leaderboard(10);
    if (!rows.length) {
      await ctx.reply('Belum ada data leaderboard Coin.');
      return;
    }

    const lines = rows.map((row, index) => {
      const name = String(row.push_name || row.number || row.jid || 'User').replace(/\n/g, ' ').slice(0, 32);
      return `${index + 1}. ${name} — ${formatCoins(row.coins)} 🪙`;
    });

    await ctx.reply(['🏆 *COIN LEADERBOARD*', '', ...lines].join('\n'));
  },
};
