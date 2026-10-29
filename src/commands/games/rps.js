import { canStartMiniGame, startGamePrompt } from './_utils.js';

export const command = {
  name: 'rps',
  description: 'Main batu, gunting, kertas melawan SkyVerse.',
  category: 'games',
  aliases: ['bgk', 'batuguntingkertas'],
  permission: 'user',
  usage: 'rps',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const text = [
      '✊ *BATU GUNTING KERTAS*',
      'Pilih langkahmu:',
      '',
      '✊ Batu',
      '✌️ Gunting',
      '✋ Kertas',
      '',
      'Balas pesan ini dengan *batu*, *gunting*, atau *kertas*.',
    ].join('\n');

    await startGamePrompt(ctx, { type: 'rps', text });
  },
};
