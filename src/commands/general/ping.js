export const command = {
  name: 'ping',
  description: 'Mengecek respons SkyVerse.',
  category: 'general',
  aliases: ['p'],
  permission: 'user',
  async execute(ctx) {
    const started = Date.now();
    const sent = await ctx.reply('Pinging...');
    const latency = Date.now() - started;

    if (sent?.key) {
      try {
        await ctx.socket.sendMessage(ctx.chatId, {
          text: `Pong! ${latency} ms`,
          edit: sent.key,
        });
      } catch {
        await ctx.reply(`Pong! ${latency} ms`);
      }
    }
  },
};
