import { levelProgress } from '../profile/config.js';

export const command = {
  name: 'xplb',
  description: 'Melihat leaderboard XP SkyVerse.',
  category: 'general',
  aliases: ['xpleaderboard', 'levelboard'],
  usage: 'xplb [jumlah]',
  permission: 'user',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 5000,
  cost: 0,
  async execute(ctx) {
    const requested = Number(ctx.parsed.args[0] ?? 10);
    const limit = Math.max(1, Math.min(10, Number.isFinite(requested) ? Math.floor(requested) : 10));
    const rows = ctx.profile.leaderboard(limit);
    const lines = rows.map((row) => {
      const progress = levelProgress(row.xp);
      return `${row.rank}. ${row.name} — Lv.${row.level} ${progress.title} · ${row.xp} XP`;
    });
    await ctx.reply(['🏆 *SKYVERSE XP LEADERBOARD*', '', ...(lines.length ? lines : ['Belum ada data XP.'])].join('\n'));
  },
};
