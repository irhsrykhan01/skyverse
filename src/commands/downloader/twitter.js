import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'twitter',
  description: 'Download media Twitter/X.',
  category: 'downloader',
  aliases: ['x'],
  usage: 'twitter <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.twitter(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'auto' });
  },
};
