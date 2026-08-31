function categoryLabel(category) {
  const value = String(category).trim().toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildAllMenu(ctx) {
  const groups = ctx.registry.byCategory({ includeHidden: false });
  const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = ctx.registry.all({ includeHidden: false }).length;
  const lines = [
    'https://saweria.co/irhsrykhn',
    '',
    '╭── ＳＫＹＶＥＲＳＥ ──',
    `│ Halo, @${ctx.senderJid?.split('@')[0] ?? 'User'}!`,
    `│ Koin: ${Number(ctx.user?.coins ?? 0)}`,
    `│ Limit: ${Number(ctx.user?.limit ?? 20)}`,
    `│ Tier: ${ctx.user?.is_premium ? 'Premium User' : 'Free User'}`,
    '╰───────────────',
    'Selamat datang di Skyverse Bot!. ☁',
    '> SkyVerse adalah bot WhatsApp atau asisten virtual WhatsApp yang siap bantu kamu bikin stiker, download video, sampai main game seru!',
    '',
    `Total Command: ${total}`,
  ];

  for (const [category, commands] of ordered) {
    lines.push('', ` ❏ *${categoryLabel(category)}*`);
    commands.forEach((item, index) => {
      const branch = index === commands.length - 1 ? '└' : '├';
      lines.push(`${branch} ${ctx.config.prefix}${item.name}`);
    });
  }

  return lines.join('\n');
}

export const command = {
  name: 'allmenu',
  description: 'Menampilkan semua command SkyVerse secara otomatis berdasarkan registry.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'allmenu',
  async execute(ctx) {
    await ctx.reply(buildAllMenu(ctx));
  },
};
