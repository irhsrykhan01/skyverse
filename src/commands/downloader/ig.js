import { findDownloaderUrls, replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'instagram',
  description: 'Download video atau foto Instagram melalui ReelsVideo.',
  category: 'downloader',
  aliases: ['ig'],
  usage: 'instagram <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.instagram(ctx.parsed.args[0]);
    const videos = findDownloaderUrls(response, { kind: 'video' });
    const images = findDownloaderUrls(response, { kind: 'image' });

    if (!videos.length && !images.length) throw new Error('ReelsVideo tidak mengembalikan media Instagram.');

    for (const url of videos.slice(0, 10)) {
      await replyWithDownloaderMedia(ctx, { result: { video: url } }, { kind: 'video' });
    }
    for (const url of images.slice(0, Math.max(0, 10 - videos.length))) {
      await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
    }
  },
};
