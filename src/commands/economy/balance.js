export const command = {
  name: 'coin',
  description: 'Melihat saldo Coin.',
  category: 'economy',
  access: 'npc',
  aliases: ['balance', 'coins', 'bal'],
  usage: 'coin',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const wallet = ctx.economy.getWallet(ctx.senderJid, {
      pushName: ctx.message?.pushName ?? null,
    });
    await ctx.reply(ctx.isOwner
      ? `🪙 Coin: ${wallet.coins} (Owner: biaya fitur gratis)`
      : `🪙 Coin: ${wallet.coins}`);
  },
};
