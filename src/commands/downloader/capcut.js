import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'capcut',
  description: 'Download video CapCut.',
  category: 'downloader',
  aliases: [],
  usage: 'capcut <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.capcut(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'video' });
  },
};
