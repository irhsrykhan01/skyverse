export const command = {
  name: 'menu',
  description: 'Menampilkan daftar command SkyVerse.',
  category: 'general',
  aliases: ['allmenu'],
  permission: 'user',
  async execute(ctx) {
    const groups = ctx.registry.byCategory();
    const lines = [`*${ctx.config.botName} Menu*`];

    for (const [category, commands] of groups) {
      lines.push('', `*${category.charAt(0).toUpperCase()}${category.slice(1)}*`);
      for (const command of commands) lines.push(`• ${ctx.config.prefix}${command.name}`);
    }

    await ctx.reply(lines.join('\n'));
  },
};
