import { formatCoins } from '../economy/config.js';

export const command = {
  name: 'profile',
  description: 'Melihat profil, level, XP, Coin, dan gelar SkyVerse.',
  category: 'general',
  aliases: ['me', 'profil'],
  usage: 'profile',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    const profile = ctx.profile.getProfile(ctx.senderJid, { pushName: ctx.message?.pushName ?? null });
    const barSize = 10;
    const filled = Math.round((profile.percent / 100) * barSize);
    const bar = '█'.repeat(filled) + '░'.repeat(barSize - filled);
    await ctx.reply([
      '╭─〔 *SKYVERSE PROFILE* 〕',
      `│ 👤 Nama   : ${profile.name}`,
      `│ ☁️ Gelar  : ${profile.title}`,
      `│ ⭐ Level  : ${profile.level}`,
      `│ ✨ XP     : ${profile.xp}`,
      `│ 📈 Progress: ${bar} ${profile.percent}%`,
      `│ 🪙 Coin   : ${formatCoins(profile.coins)}`,
      `│ 🔥 Streak : ${profile.streak} hari`,
      `│ 📝 Bio    : ${profile.bio || 'Belum diatur.'}`,
      `│ ${profile.premium ? '💎 Premium' : '▫️ Free'}`,
      '╰────────────────────',
    ].join('\n'));
  },
};
