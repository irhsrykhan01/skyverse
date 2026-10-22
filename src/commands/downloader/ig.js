import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

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
    const result = response?.result ?? {};
    const videos = Array.isArray(result.videos) ? result.videos.filter(Boolean) : [];
    const images = Array.isArray(result.images) ? result.images.filter(Boolean) : [];

    if (!videos.length && !images.length) throw new Error('ReelsVideo tidak mengembalikan media Instagram.');

    for (const url of videos.slice(0, 10)) {
      await replyWithDownloaderMedia(ctx, { result: { video: url } }, { kind: 'video' });
    }
    for (const url of images.slice(0, Math.max(0, 10 - videos.length))) {
      await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
    }
  },
};
