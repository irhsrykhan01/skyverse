import { sendVideoAsMp3, sendWithFallback } from './_generic.js';

export const command = {
  name: 'ttmp3',
  description: 'Konversi video TikTok menjadi MP3 melalui FFmpeg lokal.',
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
      { name: 'yt-dlp', run: () => ctx.providers.ytdlp.tiktok(url) },
    ], (response) => sendVideoAsMp3(ctx, response, 'skyverse-tiktok.mp3'));
  },
};
