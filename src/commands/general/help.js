export const command = {
  name: 'help',
  description: 'Menampilkan bantuan command SkyVerse.',
  category: 'general',
  aliases: ['h'],
  permission: 'user',
  usage: 'help [command]',
  examples: ['help', 'help ping'],
  async execute(ctx) {
    const requested = ctx.parsed.args[0];
    if (requested) {
      const target = ctx.registry.resolve(requested);
      if (!target || target.hidden) {
        const suggestions = ctx.registry.suggest(requested);
        await ctx.reply(
          suggestions.length
            ? `Command tidak ditemukan. Mungkin maksud kamu:\n${suggestions.map((item) => `${ctx.config.prefix}${item}`).join('\n')}`
            : `Command ${ctx.config.prefix}${requested} tidak ditemukan.`,
        );
        return;
      }

      const lines = [
        `╭━━〔 *${ctx.config.prefix}${target.name}* 〕`,
        `┃ ${target.description}`,
        `┃`,
        `┃ Usage: ${ctx.config.prefix}${target.usage ?? target.name}`,
      ];
      if (target.aliases.length) lines.push(`┃ Alias: ${target.aliases.map((item) => `${ctx.config.prefix}${item}`).join(', ')}`);
      if (target.examples.length) {
        lines.push('┃', '┃ Contoh:');
        for (const example of target.examples) lines.push(`┃ • ${ctx.config.prefix}${example}`);
      }
      lines.push('╰━━━━━━━━━━━━━━━━');
      await ctx.reply(lines.join('\n'));
      return;
    }

    const visible = ctx.registry.all({ includeHidden: false });
    await ctx.reply([
      `*SKYVERSE HELP*`,
      '',
      `Total command: ${visible.length}`,
      `Prefix: ${ctx.config.prefix}`,
      '',
      `Ketik *${ctx.config.prefix}menu* untuk melihat menu.`,
      `Ketik *${ctx.config.prefix}help <command>* untuk bantuan detail.`,
    ].join('\n'));
  },
};
