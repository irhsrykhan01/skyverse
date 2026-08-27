export const command = {
  name: 'leaderboard',
  description: 'Menampilkan pengguna dengan penggunaan command terbanyak.',
  category: 'general',
  aliases: ['lb'],
  usage: 'leaderboard',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    const rows = ctx.repositories.commands.userStats(10);
    if (!rows.length) {
      await ctx.reply('Belum ada data leaderboard.');
      return;
    }

    const lines = ['╭─〔 *SKYVERSE LEADERBOARD* 〕'];
    rows.forEach((row, index) => {
      const jid = String(row.user_jid || '');
      const mention = jid.includes('@') ? `@${jid.split('@')[0]}` : jid;
      lines.push(`│ ${index + 1}. ${mention} — ${Number(row.usage_count || 0)} command`);
    });
    lines.push('╰────────────────────');
    await ctx.reply(lines.join('\n'), {
      sendOptions: {
        mentions: rows.map((row) => row.user_jid).filter((jid) => String(jid).includes('@')),
      },
    });
  },
};
