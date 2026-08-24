const CATEGORY_META = Object.freeze({
  general: { icon: '✦', label: 'General' },
  group: { icon: '◈', label: 'Group' },
  sticker: { icon: '◆', label: 'Sticker & Media' },
  downloader: { icon: '↧', label: 'Downloader' },
  tools: { icon: '⚙', label: 'Tools' },
});

function titleFor(category) {
  const key = String(category).toLowerCase();
  return CATEGORY_META[key] ?? { icon: '•', label: key.charAt(0).toUpperCase() + key.slice(1) };
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu SkyVerse.',
  category: 'general',
  aliases: ['allmenu'],
  permission: 'user',
  async execute(ctx) {
    const groups = ctx.registry.byCategory();
    const total = ctx.registry.all().length;
    const categoryCount = groups.size;
    const lines = [
      '╭━━━〔 *SKYVERSE* 〕━━━╮',
      `┃ ✦ *Bot* : ${ctx.config.botName}`,
      `┃ ✦ *Status* : Online`,
      `┃ ✦ *Prefix* : ${ctx.config.prefix}`,
      `┃ ✦ *Commands* : ${total}`,
      `┃ ✦ *Categories* : ${categoryCount}`,
      '╰━━━━━━━━━━━━━━━━━━━━╯',
    ];

    for (const [category, commands] of groups) {
      const meta = titleFor(category);
      lines.push('', `┌─〔 ${meta.icon} *${meta.label.toUpperCase()}* 〕`);
      for (const item of commands) {
        lines.push(`│ ${ctx.config.prefix}${item.name}`);
      }
      lines.push('└────────────────────');
    }

    lines.push('', `Ketik *${ctx.config.prefix}help <command>* untuk melihat detail command.`);
    await ctx.reply(lines.join('\n'));
  },
};
