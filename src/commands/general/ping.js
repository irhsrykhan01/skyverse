export const command = {
  name: 'ping',
  description: 'Mengecek respons SkyVerse.',
  category: 'general',
  aliases: ['p'],
  permission: 'user',
  async execute(ctx) {
    // Newsletter/channel clients do not reliably support editing a sent
    // message with the same envelope as private/group chats. Send the final
    // response directly there so the user never gets stuck on "Pinging...".
    if (ctx.isChannel || ctx.isBroadcast) {
      const started = Date.now();
      await ctx.reply('Pong!');
      return;
    }

    const started = Date.now();
    const sent = await ctx.reply('Pinging...');
    const latency = Date.now() - started;

    if (sent?.key) {
      try {
        await ctx.socket.sendMessage(ctx.chatId, {
          text: `Pong! ${latency} ms`,
          edit: sent.key,
        });
        return;
      } catch {
        await ctx.reply(`Pong! ${latency} ms`);
      }
    }
  },
};
