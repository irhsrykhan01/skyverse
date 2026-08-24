export const command = {
  name: 'calculator',
  description: 'Menghitung ekspresi matematika sederhana.',
  category: 'tools',
  aliases: ['calc'],
  usage: 'calculator <ekspresi>',
  examples: ['calculator 12 * (3 + 2)', 'calc 100 / 4'],
  permission: 'user',
  minArgs: 1,
  cooldown: 1000,
  async execute(ctx) {
    const expression = ctx.parsed.args.join(' ');
    try {
      const result = ctx.calculate(expression);
      await ctx.reply(`*Calculator*\n${expression} = *${result}*`);
    } catch (error) {
      await ctx.reply(`Calculator error: ${error?.message ?? String(error)}`);
    }
  },
};
