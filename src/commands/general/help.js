export const command = {
  name: 'help',
  description: 'Menampilkan bantuan command SkyVerse.',
  category: 'general',
  aliases: ['h'],
  permission: 'user',
  async execute(ctx) {
    const requested = ctx.parsed.args[0];
    if (requested) {
      const target = ctx.registry.resolve(requested);
      if (!target) {
        const suggestions = ctx.registry.suggest(requested);
        await ctx.reply(
          suggestions.length
            ? `Command tidak ditemukan. Mungkin:\n${suggestions.map((item) => `${ctx.config.prefix}${item}`).join('\n')}`
            : `Command ${ctx.config.prefix}${requested} tidak ditemukan.`,
        );
        return;
      }

      const usage = target.usage ? `\nUsage: ${ctx.config.prefix}${target.usage}` : '';
      const aliases = target.aliases.length ? `\nAlias: ${target.aliases.map((item) => `${ctx.config.prefix}${item}`).join(', ')}` : '';
      await ctx.reply(`*${ctx.config.prefix}${target.name}*\n${target.description}${usage}${aliases}`);
      return;
    }

    await ctx.reply(`Ketik ${ctx.config.prefix}menu untuk melihat semua command.\nKetik ${ctx.config.prefix}help <command> untuk bantuan command tertentu.`);
  },
};
