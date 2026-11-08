const COOLDOWN_MS = 30 * 60 * 1000;
const REWARD_MIN = 8;
const REWARD_MAX = 15;
const lastWork = new Map();

function randomReward() {
  return Math.floor(Math.random() * (REWARD_MAX - REWARD_MIN + 1)) + REWARD_MIN;
}

export const command = {
  name: 'work',
  description: 'Bekerja untuk mendapatkan coin.',
  category: 'economy',
  aliases: ['kerja'],
  usage: 'work',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const now = Date.now();
    const previous = lastWork.get(ctx.senderJid) ?? 0;
    const remaining = COOLDOWN_MS - (now - previous);
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      await ctx.reply(`Kamu masih lelah. Coba kerja lagi dalam ${minutes} menit.\n🪙 Saldo: ${ctx.economy.getCoins(ctx.senderJid)}`);
      return;
    }

    const reward = randomReward();
    const balance = ctx.economy.addCoins(ctx.senderJid, reward, 'work');
    lastWork.set(ctx.senderJid, now);
    await ctx.reply(`🧰 *WAKTUNYA BEKERJA!*\nKamu menyelesaikan pekerjaan kecil dan mendapat +${reward} 🪙.\n\n💰 Saldo sekarang: ${balance} 🪙\n⏳ Bisa bekerja lagi dalam 30 menit.`);
  },
};
