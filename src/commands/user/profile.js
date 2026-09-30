export const command = {
  name: 'userprofile',
  description: 'Menampilkan ringkasan akun user dan statistik command.',
  category: 'general',
  aliases: ['uprof'],
  usage: 'userprofile',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const profile = ctx.profile.getProfile(ctx.senderJid, { pushName: ctx.message?.pushName ?? null });
    const stats = ctx.repositories.commands.userStats(100).find((item) => item.user_jid === ctx.senderJid);
    await ctx.reply([
      '╭─〔 *USER PROFILE* 〕',
      `│ Nama     : ${profile.name}`,
      `│ Commands : ${Number(stats?.usage_count || 0)}`,
      `│ Level    : ${profile.level}`,
      `│ Gelar    : ${profile.title}`,
      `│ XP       : ${profile.xp}`,
      `│ Coin     : ${ctx.economy.format(profile.coins)}`,
      '╰────────────────',
    ].join('\n'));
  },
};
