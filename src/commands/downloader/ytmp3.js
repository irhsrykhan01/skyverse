import { sendAudioDownload, sendWithFallback } from './_generic.js';

export const command = {
  name: 'ytmp3',
  description: 'Download audio MP3 dari YouTube.',
  category: 'downloader',
  aliases: [],
  usage: 'ytmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'Siputzx', run: () => ctx.providers.siputzx.youtubeMp3(url) },
      { name: 'Deline', run: () => ctx.providers.deline.youtubeMp3(url) },
      { name: 'Zenzxz', run: () => ctx.providers.zenzxz.youtubeMp3(url) },
      { name: 'Vreden', run: () => ctx.providers.vreden.youtubeMp3(url) },
    ], (response) => sendAudioDownload(ctx, response, 'skyverse-youtube.mp3'));
  },
};
