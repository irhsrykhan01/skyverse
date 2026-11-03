import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'youtube',
  description: 'Download video YouTube, termasuk YouTube Shorts, melalui yt-dlp.',
  category: 'downloader',
  aliases: ['yt'],
  usage: 'youtube <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.youtube(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'video' });
  },
};
