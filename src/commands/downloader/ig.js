import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'instagram',
  description: 'Download Reel/video Instagram publik melalui yt-dlp.',
  category: 'downloader',
  aliases: ['ig'],
  usage: 'instagram <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.instagram(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'video' });
  },
};
