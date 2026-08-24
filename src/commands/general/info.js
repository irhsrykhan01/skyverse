export const command = {
  name: 'info',
  description: 'Menampilkan informasi SkyVerse dan runtime.',
  category: 'general',
  aliases: ['runtime', 'botinfo'],
  permission: 'user',
  async execute(ctx) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86_400);
    const hours = Math.floor((uptime % 86_400) / 3_600);
    const minutes = Math.floor((uptime % 3_600) / 60);
    const seconds = Math.floor(uptime % 60);

    await ctx.reply([
      `*${ctx.config.botName}*`,
      '',
      'Status: Online',
      `Runtime: ${days}d ${hours}h ${minutes}m ${seconds}s`,
      `Node.js: ${process.versions.node}`,
      `Platform: ${process.platform}/${process.arch}`,
      `Prefix: ${ctx.config.prefix}`,
    ].join('\n'));
  },
};
