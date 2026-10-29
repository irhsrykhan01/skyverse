import { getRandomWordData } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

export const command = {
  name: 'tebakkata',
  description: 'Tebak kata bahasa Inggris dari definisinya.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'tebakkata',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const wordData = await getRandomWordData();
    const attribution = wordData.source === 'WordSoHard'
      ? 'Data kamus: WordSoHard (wordsohard.com).'
      : 'Sumber definisi: bank offline SkyVerse; kamus: WordSoHard (wordsohard.com).';
    const text = [
      '📖 *TEBAK KATA*',
      'Tebak satu kata bahasa Inggris dari definisi berikut:',
      '',
      wordData.definition,
      '',
      'Kamu punya 3 kesempatan. Balas pesan ini dengan satu kata.',
      attribution,
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'tebakkata',
      answer: wordData.word,
      state: { definition: wordData.definition, attribution, attempts: 0, maxAttempts: 3 },
      text,
    });
  },
};
