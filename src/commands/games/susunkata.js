import { getRandomWordData, shuffleArray } from '../../services/games-api.js';
import { canStartMiniGame, startGamePrompt } from './_utils.js';

function scramble(word) {
  const letters = word.split('');
  let mixed = shuffleArray(letters).join('');
  if (mixed === word) mixed = word.slice(1) + word[0];
  return mixed.toUpperCase().split('').join(' ');
}

export const command = {
  name: 'susunkata',
  description: 'Susun huruf acak menjadi kata bahasa Inggris.',
  category: 'games',
  aliases: [],
  permission: 'user',
  usage: 'susunkata',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    if (!await canStartMiniGame(ctx)) return;
    const wordData = await getRandomWordData();
    const attribution = wordData.source === 'WordSoHard'
      ? 'Data kamus: WordSoHard (wordsohard.com).'
      : 'Sumber kata: bank offline SkyVerse; kamus: WordSoHard (wordsohard.com).';
    const text = [
      '🔤 *SUSUN KATA*',
      'Susun huruf berikut menjadi kata bahasa Inggris:',
      '',
      '*' + scramble(wordData.word) + '*',
      '',
      'Kamu punya 3 kesempatan. Balas pesan ini dengan jawabannya.',
      attribution,
    ].join('\n');

    await startGamePrompt(ctx, {
      type: 'susunkata',
      answer: wordData.word,
      state: { definition: wordData.definition, attribution, attempts: 0, maxAttempts: 3 },
      text,
    });
  },
};
