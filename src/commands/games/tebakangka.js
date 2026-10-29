import { canStartMiniGame, startGamePrompt } from './_utils.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const command = {
  name: 'tebakangka',
  description: 'Tebak angka rahasia dari 1 sampai 30.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'tebakangka',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const answer = randomInt(1, 30);
    const text = [
      '🔢 *TEBAK ANGKA*',
      'Aku memilih angka dari 1 sampai 30.',
      'Kamu punya 6 kesempatan.',
      '',
      'Balas pesan ini dengan tebakan angka.',
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'tebakangka',
      answer,
      state: { minimum: 1, maximum: 30, attempts: 0, maxAttempts: 6 },
      text,
    });
  },
};
