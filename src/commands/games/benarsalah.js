import { getTriviaQuestions } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

export const command = {
  name: 'benarsalah',
  description: 'Tebak apakah pernyataan trivia itu benar atau salah.',
  category: 'games',
  aliases: ['bs'],
  permission: 'user',
  usage: 'benarsalah',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const questions = await getTriviaQuestions({ amount: 1, type: 'boolean' });
    const question = questions[0];
    const isTrue = String(question.correctAnswer).toLowerCase() === 'true';
    const source = question.source === 'Open Trivia DB'
      ? 'Sumber soal: Open Trivia DB (opentdb.com).'
      : 'Sumber soal: bank offline SkyVerse.';
    const text = [
      '✅❌ *BENAR / SALAH*',
      '',
      question.question,
      '',
      'Balas dengan *benar* atau *salah*.',
      source,
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'benarsalah',
      answer: isTrue,
      state: { question: question.question },
      text,
    });
  },
};
