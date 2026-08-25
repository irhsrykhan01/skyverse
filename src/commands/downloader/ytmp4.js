import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'ytmp4',
  description: 'Download video MP4 dari YouTube.',
  category: 'downloader',
  aliases: [],
  usage: 'ytmp4 <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.youtube(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'video', filename: 'skyverse-youtube.mp4' });
  },
};
