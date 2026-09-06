import { getMenuCategoryLabel, resolveMenuCategory } from '../../core/menu-categories.js';

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
    const requested = String(ctx.parsed.args[0] ?? '').trim();
    const category = resolveMenuCategory(requested);
    const groups = ctx.registry.byCategory({ includeHidden: false });
    const commands = category ? groups.get(category) ?? [] : [];

    if (!commands.length) {
      await ctx.reply(`Kategori tidak tersedia: ${requested}`);
      return;
    }

    const label = getMenuCategoryLabel(category);
    const lines = [
      `*${label} Menu!*`,
      '',
      ...commands.map((item) => `- ${ctx.config.prefix}${item.name}`),
    ];

    await ctx.reply(lines.join('\n'));
  },
};
