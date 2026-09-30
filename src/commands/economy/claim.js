import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'claim',
  description: 'Mengambil bonus Coin berkala setiap 3 jam.',
  category: 'economy',
  access: 'npc',
  aliases: [],
  usage: 'claim',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const result = ctx.economy.claim(ctx.senderJid, Date.now(), {
      pushName: ctx.message?.pushName ?? null,
    });

    if (!result.ok) {
      const hours = Math.floor(result.remaining / 3600000);
      const minutes = Math.ceil((result.remaining % 3600000) / 60000);
      await ctx.reply([
        `Claim berikutnya dalam ${hours}j ${minutes}m.`,
        `🪙 Saldo: ${formatCoins(result.balance)}`,
      ].join('\\n'));
      return;
    }

    const xp = ctx.profile?.addXp(ctx.senderJid, 8, 'economy:claim');

    await ctx.reply([
      '🎁 *CLAIM BERHASIL*',
      `+${formatCoins(result.amount)} 🪙`,
      `+${xp?.added ?? 0} XP ✨`,
      `🪙 Saldo: ${formatCoins(result.balance)}`,
      xp?.leveledUp ? `🎉 *LEVEL UP!* Sekarang Level ${xp.level} — ${xp.title}` : '',
    ].filter(Boolean).join('\n'));
  },
};