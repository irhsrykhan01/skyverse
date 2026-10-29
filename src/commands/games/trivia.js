import { formatMultipleChoice, getTriviaQuestions } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

export const command = {
  name: 'trivia',
  description: 'Kuis trivia pilihan ganda dari API tanpa key.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'trivia',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const questions = await getTriviaQuestions({ amount: 1, type: 'multiple' });
    const question = formatMultipleChoice(questions[0]);
    const source = question.source === 'Open Trivia DB'
      ? 'Sumber soal: Open Trivia DB (opentdb.com).'
      : 'Sumber soal: bank offline SkyVerse.';
    const text = [
      '🧠 *TRIVIA*',
      'Kategori: ' + question.category + ' • Level: ' + question.difficulty,
      '',
      question.question,
      '',
      question.optionsText,
      '',
      'Balas pesan ini dengan A, B, C, atau D.',
      source,
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'trivia',
      answer: question.correctLetter,
      state: { choices: question.choices, correctLetter: question.correctLetter, correctAnswer: question.correctAnswer },
      text,
    });
  },
};
