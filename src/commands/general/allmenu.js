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
    '╭━━━〔 *SKYVERSE ALL MENU* 〕━━━╮',
    `┃ Bot      : ${ctx.config.botName}`,
    `┃ Prefix   : ${ctx.config.prefix}`,
    `┃ Commands : ${total}`,
    `┃ Category : ${ordered.length}`,
    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
  ];

  for (const [category, commands] of ordered) {
    lines.push('', `┌─〔 *${categoryLabel(category).toUpperCase()} MENU* 〕`);
    for (const item of commands) {
      const alias = item.aliases[0] ? ` — ${ctx.config.prefix}${item.aliases[0]}` : '';
      lines.push(`│ ${ctx.config.prefix}${item.name}${alias} — ${item.description}`);
    }
    lines.push('└────────────────────────');
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
