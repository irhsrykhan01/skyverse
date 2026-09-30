import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'daily', description: 'Mengambil hadiah harian dan membangun streak.', category: 'economy', access: 'npc', aliases: ['harian'], usage: 'daily', permission: 'user', minArgs: 0, maxArgs: 0, cooldown: 0, cost: 0,
  async execute(ctx) {
    const result = ctx.economy.daily(ctx.senderJid, Date.now(), { pushName: ctx.message?.pushName ?? null });
    if (!result.ok) {
      const hours = Math.floor(result.remaining / 3600000);
      const minutes = Math.ceil((result.remaining % 3600000) / 60000);
      await ctx.reply(`Daily berikutnya dalam ${hours}j ${minutes}m.\n🔥 Streak: ${result.streak ?? 0} hari\n🪙 Coin: ${formatCoins(result.balance)}`);
      return;
    }
    const xp = ctx.profile?.addXp(ctx.senderJid, 15, 'economy:daily');
    ctx.progression?.processEvent(ctx.senderJid, 'daily');
    ctx.progression?.processEvent(ctx.senderJid, 'reward_total', result.amount);
    ctx.progression?.progressQuest(ctx.senderJid, 'daily', 1);
    if (xp?.added) ctx.progression?.progressQuest(ctx.senderJid, 'xp', xp.added);
    await ctx.reply([
      '🎁 *DAILY REWARD*', `+${formatCoins(result.amount)} 🪙`, `+${xp?.added ?? 0} XP ✨`, `🔥 Streak: ${result.streak} hari`, `🪙 Saldo: ${formatCoins(result.balance)}`,
      xp?.leveledUp ? `🎉 *LEVEL UP!* Sekarang Level ${xp.level} — ${xp.title}` : '',
    ].filter(Boolean).join('\n'));
  },
};
