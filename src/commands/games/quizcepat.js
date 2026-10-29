import { formatMultipleChoice, getTriviaQuestions } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

function renderQuestion(question, index, total) {
  const source = question.source === 'Open Trivia DB'
    ? 'Sumber soal: Open Trivia DB (opentdb.com).'
    : 'Sumber soal: bank offline SkyVerse.';
  return [
    '⚡ *QUIZ CEPAT*',
    'Soal ' + (index + 1) + '/' + total + ' • Skor: 0',
    'Kategori: ' + question.category,
    '',
    question.question,
    '',
    question.optionsText,
    '',
    'Balas pesan ini dengan A, B, C, atau D.',
    source,
  ].join('\n');
}

export const command = {
  name: 'quizcepat',
  description: 'Quiz lima soal dengan waktu jawab singkat.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'quizcepat',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const questions = await getTriviaQuestions({ amount: 5, type: 'multiple' });
    const prepared = questions.map(formatMultipleChoice);
    const first = prepared[0];

    await startGamePrompt(ctx, {
      type: 'quizcepat',
      state: { questions: prepared, index: 0, score: 0 },
      expiresIn: 5 * 60 * 1000,
      text: renderQuestion(first, 0, prepared.length),
    });
  },
};
