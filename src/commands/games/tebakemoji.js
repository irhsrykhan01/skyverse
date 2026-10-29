import { shuffleArray } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

const PUZZLES = [
  { emoji: '🌞 + 🌻', answer: 'bunga matahari', accepted: ['sunflower'] },
  { emoji: '🦷 + 🪥', answer: 'sikat gigi', accepted: ['gosok gigi', 'toothbrush'] },
  { emoji: '🌧️ + 🌈', answer: 'pelangi', accepted: ['rainbow'] },
  { emoji: '🍞 + 🧀', answer: 'roti keju', accepted: ['cheese bread'] },
  { emoji: '🎂 + 🕯️', answer: 'kue ulang tahun', accepted: ['kue ultah', 'birthday cake', 'ultah'] },
  { emoji: '🍚 + 🐔', answer: 'nasi ayam', accepted: ['ayam dan nasi', 'chicken rice'] },
  { emoji: '🐝 + 🍯', answer: 'madu', accepted: ['honey'] },
  { emoji: '🏖️ + 🌊', answer: 'pantai', accepted: ['beach'] },
  { emoji: '🌙 + ⭐', answer: 'bulan dan bintang', accepted: ['bulan bintang', 'moon and stars'] },
  { emoji: '🐱 + 🥛', answer: 'kucing minum susu', accepted: ['kucing dan susu', 'cat milk'] },
];

export const command = {
  name: 'tebakemoji',
  description: 'Tebak frasa yang digambarkan oleh kombinasi emoji.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'tebakemoji',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const puzzle = shuffleArray(PUZZLES)[0];
    const text = [
      '🎭 *TEBAK EMOJI*',
      'Tebak frasa dari kombinasi emoji ini:',
      '',
      '*' + puzzle.emoji + '*',
      '',
      'Kamu punya 3 kesempatan. Balas pesan ini dengan jawabanmu.',
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'tebakemoji',
      answer: puzzle.answer,
      state: { accepted: puzzle.accepted, attempts: 0, maxAttempts: 3 },
      text,
    });
  },
};
