import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'daily',
  description: 'Mengambil hadiah harian dan membangun streak.',
  category: 'economy',
  access: 'npc',
  aliases: ['harian'],
  usage: 'daily',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const result = ctx.economy.daily(ctx.senderJid, Date.now(), {
      pushName: ctx.message?.pushName ?? null,
    });

    if (!result.ok) {
      const hours = Math.floor(result.remaining / 3600000);
      const minutes = Math.ceil((result.remaining % 3600000) / 60000);
      await ctx.reply(`Daily berikutnya dalam ${hours}j ${minutes}m.\n🔥 Streak: ${result.streak ?? 0} hari\n🪙 Coin: ${formatCoins(result.balance)}`);
      return;
    }

    await ctx.reply([
      '🎁 *DAILY REWARD*',
      `+${formatCoins(result.amount)} 🪙`,
      `🔥 Streak: ${result.streak} hari`,
      `🪙 Saldo: ${formatCoins(result.balance)}`,
    ].join('\n'));
  },
};
