export const command = {
  name: 'xp',
  description: 'Melihat level dan progress XP kamu.',
  category: 'general',
  aliases: ['level', 'lvl'],
  usage: 'xp',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 2000,
  cost: 0,
  async execute(ctx) {
    const progress = ctx.profile.getProgress(ctx.senderJid);
    const remaining = Math.max(0, progress.needed - progress.progress);
    await ctx.reply([
      `⭐ *LEVEL ${progress.level} — ${progress.title}*`,
      `✨ XP: ${progress.currentXp}`,
      `📈 Progress: ${progress.percent}%`,
      progress.level >= 22 ? '👑 Level maksimum kategori saat ini tercapai.' : `🎯 Butuh ${remaining} XP lagi untuk Level ${progress.level + 1}.`,
    ].join('\n'));
  },
};
