import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

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
    const result = response?.result ?? {};
    const images = Array.isArray(result.images) ? result.images.filter(Boolean) : [];

    if (images.length && !result.video) {
      for (const url of images.slice(0, 10)) {
        await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
      }
      return;
    }

    if (result.video) {
      await replyWithDownloaderMedia(ctx, { result: { video: result.video } }, { kind: 'video' });
      return;
    }

    if (images.length) {
      for (const url of images.slice(0, 10)) {
        await replyWithDownloaderMedia(ctx, { result: { image: url } }, { kind: 'image' });
      }
      return;
    }

    throw new Error('TikWM tidak mengembalikan video atau foto.');
  },
};
