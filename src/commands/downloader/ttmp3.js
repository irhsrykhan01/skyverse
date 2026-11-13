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
    const fallbacks = [
      { name: 'TikWM', run: () => ctx.providers.tikwm.tiktok(url) },
      { name: 'yt-dlp', run: () => ctx.providers.ytdlp.tiktok(url) },
    ];
    if (ctx.config.sairiHostDownloaderEnabled && ctx.config.sairiHostApiKey) {
      fallbacks.push({ name: 'SairiHost', run: () => ctx.providers.downloader.sairiHostTikTok(url) });
    }
    await sendWithFallback(ctx, fallbacks, (response) => sendVideoAsMp3(ctx, response, 'skyverse-tiktok.mp3'));
  },
};
