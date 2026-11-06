import { sendTikTokDownload, sendWithFallback } from './_generic.js';

export const command = {
  name: 'tiktok',
  description: 'Download video atau photo carousel TikTok melalui TikWM dengan fallback yt-dlp.',
  category: 'downloader',
  aliases: ['tt'],
  usage: 'tiktok <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'TikWM', run: () => ctx.providers.tikwm.tiktok(url) },
      { name: 'yt-dlp', run: () => ctx.providers.ytdlp.tiktok(url) },
    ], (response) => sendTikTokDownload(ctx, response));
  },
};
