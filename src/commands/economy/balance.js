export const command = {
  name: 'coin',
  aliases: ['balance', 'coins', 'bal'],
  description: 'Melihat saldo coin.',
  category: 'economy',
  access: 'npc',
  aliases: ['coin', 'coins'],
  usage: 'balance',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const wallet = ctx.economy.getWallet(ctx.senderJid, {
      pushName: ctx.message?.pushName ?? null,
    });
    await ctx.reply(`🪙 Coin: ${wallet.coins}`);
  },
};
