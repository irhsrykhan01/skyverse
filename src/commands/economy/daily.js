const DAILY_REWARD = 200;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

function formatRemaining(milliseconds) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} jam ${minutes} menit`;
  if (hours) return `${hours} jam`;
  return `${minutes} menit`;
}

export const command = {
  name: 'daily',
  description: 'Klaim hadiah harian sebesar 200 Coin setiap 24 jam.',
  category: 'general',
  aliases: ['harian'],
  permission: 'user',
  usage: 'daily',
  async execute(ctx) {
    const result = ctx.repositories.economy.claimDaily(
      ctx.senderJid,
      DAILY_REWARD,
      DAILY_COOLDOWN,
    );

    if (!result.ok) {
      if (result.reason === 'cooldown') {
        await ctx.reply(
          `🎁 Kamu sudah mengambil hadiah Daily hari ini.\nCoba lagi dalam *${formatRemaining(result.nextAt - Date.now())}*.`,
        );
        return;
      }
      throw new Error('Hadiah Daily gagal diproses. Coba lagi nanti.');
    }

    await ctx.reply([
      '🎁 *DAILY REWARD BERHASIL!*',
      '',
      `🪙 Hadiah: +${result.reward.toLocaleString('id-ID')} Coin`,
      `💰 Saldo sekarang: ${ctx.isOwner ? 'Unlimited (Owner)' : result.coins.toLocaleString('id-ID') + ' Coin'}`,
      '',
      'Kembali lagi 24 jam dari sekarang untuk klaim berikutnya!',
    ].join('\n'));
  },
};
