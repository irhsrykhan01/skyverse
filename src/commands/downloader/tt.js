import { findDownloaderUrls, replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'tiktok',
  description: 'Download video atau photo carousel TikTok melalui TikWM.',
  category: 'downloader',
  aliases: ['tt'],
  usage: 'tiktok <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.tiktok(ctx.parsed.args[0]);
    const images = findDownloaderUrls(response, { kind: 'image' });
    const videos = findDownloaderUrls(response, { kind: 'video' });

    if (images.length > 1 && !videos.length) {
      for (const url of images.slice(0, 10)) {
        await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
      }
      return;
    }

    await replyWithDownloaderMedia(ctx, response, { kind: videos.length ? 'video' : 'image' });
  },
};
