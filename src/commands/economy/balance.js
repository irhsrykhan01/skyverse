import { formatCoins } from '../../economy/config.js';

export const command = {
  name: 'balance',
  description: 'Melihat saldo Coin dan ringkasan wallet.',
  category: 'economy',
  access: 'npc',
  aliases: ['coin', 'coins', 'bal'],
  usage: 'balance',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const wallet = ctx.economy.getWallet(ctx.senderJid, {
      pushName: ctx.message?.pushName ?? null,
    });
    const profile = ctx.profile?.getProfile(ctx.senderJid, {
      pushName: ctx.message?.pushName ?? null,
    });

    await ctx.reply([
      '╭─〔 *WALLET* 〕',
      `│ 🪙 Coin    : ${formatCoins(wallet.coins)}`,
      `│ ⭐ Level   : ${profile?.level ?? 1}`,
      `│ ☁️ Gelar   : ${profile?.title ?? 'Bintang Kecil'}`,
      `│ 🔥 Streak  : ${wallet.dailyStreak} hari`,
      `│ ⭐ Tier    : ${wallet.isPremium ? 'Premium' : 'Free'}`,
      '╰────────────────',
    ].join('\\n'));
  },
};