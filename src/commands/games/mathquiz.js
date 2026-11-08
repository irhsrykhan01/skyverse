import { startMathQuiz, getMathQuiz, formatMathQuestion } from '../../games/mathquiz.js';

export const command = {
  name: 'mathquiz',
  description: 'Tantangan hitung cepat untuk mendapatkan coin.',
  category: 'games',
  aliases: ['quizmath', 'hitungcepat'],
  usage: 'mathquiz',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    if (getMathQuiz(ctx.senderJid)) {
      await ctx.reply('Kamu masih punya soal yang aktif. Reply soal sebelumnya dengan jawaban angka.');
      return;
    }

    const session = startMathQuiz(ctx.senderJid, { chatId: ctx.chatId });
    const sent = await ctx.socket.sendMessage(ctx.chatId, {
      text: ['🧠 *MATH QUIZ*', '', `Berapa hasil dari ${formatMathQuestion(session)}`, '', 'Reply pesan ini dengan jawaban angka.', '⏳ Waktu menjawab: 2 menit', '🎁 Hadiah: 2–6 coin'].join('\n'),
    }, { quoted: ctx.message });

    if (!sent?.key?.id) {
      await ctx.reply('Soal gagal dikirim. Coba lagi.');
      return;
    }
    const updated = startMathQuiz(ctx.senderJid, { chatId: ctx.chatId, gameMessageId: sent.key.id, now: session.startedAt });
    if (updated.answer !== session.answer) throw new Error('Math quiz session berubah saat pesan dikirim.');
  },
};
