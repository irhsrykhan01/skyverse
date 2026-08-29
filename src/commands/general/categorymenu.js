function categoryLabel(category) {
  const value = String(category).trim().toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const command = {
  name: 'categorymenu',
  description: 'Menampilkan daftar command dalam kategori yang dipilih.',
  category: 'system',
  permission: 'user',
  hidden: true,
  minArgs: 1,
  maxArgs: 1,
  usage: 'categorymenu <category>',
  async execute(ctx) {
    const category = String(ctx.parsed.args[0] ?? '').trim().toLowerCase();
    const groups = ctx.registry.byCategory({ includeHidden: false });
    const commands = groups.get(category) ?? [];

    if (!commands.length) {
      await ctx.reply(`Kategori tidak tersedia: ${category}`);
      return;
    }

    const lines = [
      `*${categoryLabel(category)} Menu!*`,
      '',
      ...commands.map((item) => `- ${ctx.config.prefix}${item.name}`),
    ];

    await ctx.reply(lines.join('\n'));
  },
};
