import { sendAudioDownload, sendWithFallback } from './_generic.js';

export const command = {
  name: 'ttmp3',
  description: 'Mengambil audio MP3 dari TikTok.',
  category: 'downloader',
  aliases: [],
  usage: 'ttmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'TikWM', run: () => ctx.providers.tikwm.tiktok(url) },
      { name: 'Deline', run: () => ctx.providers.deline.call('/downloader/tiktok', { url }) },
      { name: 'Zenzxz', run: () => ctx.providers.zenzxz.call('/downloader/tiktok', { url }) },
    ], (response) => sendAudioDownload(ctx, response, 'skyverse-tiktok.mp3'));
  },
};
