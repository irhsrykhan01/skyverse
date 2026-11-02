export const command = {
  name: 'helper',
  description: 'Mencari command SkyVerse yang paling mirip dengan nama yang dimasukkan.',
  category: 'general',
  aliases: ['cmdhelp'],
  usage: 'helper <nama-command>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  async execute(ctx) {
    const query = String(ctx.parsed.args[0] ?? '').trim().toLowerCase();
    const suggestions = ctx.registry.suggest(query)
      .filter((name) => ctx.registry.resolve(name))
      .slice(0, 3);

    if (!suggestions.length) {
      await ctx.reply(`Tidak ada command yang cukup mirip dengan "${query}". Ketik ${ctx.config.prefix}allmenu untuk melihat daftar command.`);
      return;
    }

    await ctx.reply([
      '🔎 *COMMAND HELPER*',
      `Pencarian: ${query}`,
      '',
      'Mungkin yang kamu maksud:',
      ...suggestions.map((name) => `• ${ctx.config.prefix}${name}`),
      '',
      `Ketik ${ctx.config.prefix}help <command> untuk melihat cara penggunaan.`,
    ].join('\\n'));
  },
};
