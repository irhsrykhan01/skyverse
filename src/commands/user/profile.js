function getTarget(ctx) {
  const mentioned = ctx.message?.message?.extendedTextMessage?.contextInfo?.mentionedJid
    ?? ctx.message?.message?.imageMessage?.contextInfo?.mentionedJid
    ?? ctx.message?.message?.videoMessage?.contextInfo?.mentionedJid;
  if (Array.isArray(mentioned) && mentioned[0]) return mentioned[0];
  return ctx.senderJid;
}

export const command = {
  name: 'profile',
  description: 'Menampilkan profile user dan statistik command.',
  category: 'general',
  aliases: ['me'],
  usage: 'profile [@user]',
  permission: 'user',
  minArgs: 0,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const target = getTarget(ctx);
    const user = ctx.repositories.users.get(target);
    const stats = ctx.repositories.commands.userStats(100).find((item) => item.user_jid === target);
    const afkRaw = ctx.repositories.settings.get('user', target, 'user.afk', null);
    let afkText = 'Tidak';
    try {
      const afk = afkRaw ? JSON.parse(afkRaw) : null;
      if (afk?.enabled) afkText = `Ya — ${afk.reason || 'AFK'}`;
    } catch {}

    const name = user?.push_name || target?.split('@')[0] || 'Unknown';
    await ctx.reply([
      '╭─〔 *PROFILE* 〕',
      `│ Nama     : ${name}`,
      `│ Nomor    : +${user?.number || target?.split('@')[0] || '-'}`,
      `│ Commands : ${Number(stats?.usage_count || 0)}`,
      `│ AFK      : ${afkText}`,
      user?.created_at ? `│ Sejak    : ${new Date(user.created_at).toLocaleDateString('id-ID')}` : '│ Sejak    : -',
      '╰────────────────',
    ].join('\n'), {
      sendOptions: target?.includes('@') ? { mentions: [target] } : {},
    });
  },
};
