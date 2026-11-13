import { sendTikTokDownload, sendWithFallback } from './_generic.js';

export const command = {
  name: 'tiktok',
  description: 'Download video atau photo carousel TikTok melalui TikWM dan yt-dlp, dengan fallback SairiHost opsional.',
  category: 'downloader',
  aliases: ['tt'],
  usage: 'tiktok <url>',
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
    await sendWithFallback(ctx, fallbacks, (response) => sendTikTokDownload(ctx, response));
  },
};
