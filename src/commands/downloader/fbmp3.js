import { sendAudioDownload, sendWithFallback } from './_generic.js';

export const command = {
  name: 'fbmp3',
  description: 'Mengambil audio MP3 dari Facebook.',
  category: 'downloader',
  aliases: [],
  usage: 'fbmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'Deline', run: () => ctx.providers.deline.facebook(url) },
      { name: 'Zenzxz', run: () => ctx.providers.zenzxz.facebook(url) },
    ], (response) => sendAudioDownload(ctx, response, 'skyverse-facebook.mp3'));
  },
};
