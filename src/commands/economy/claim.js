export const command = {
  name: 'claim',
  description: 'Mengambil bonus coin berkala.',
  category: 'economy',
  access: 'npc',
  aliases: [],
  usage: 'claim',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const result = ctx.economy.claim(ctx.senderJid, Date.now(), {
      pushName: ctx.message?.pushName ?? null,
    });

    if (!result.ok) {
      const hours = Math.floor(result.remaining / 3600000);
      const minutes = Math.ceil((result.remaining % 3600000) / 60000);
      await ctx.reply(`Claim berikutnya dalam ${hours}j ${minutes}m.\n🪙 Coin: ${result.balance}`);
      return;
    }

    await ctx.reply(`🎁 Claim berhasil! +${result.amount} 🪙\n🪙 Coin: ${result.balance}`);
  },
};
