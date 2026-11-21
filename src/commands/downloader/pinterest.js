import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'pinterest',
  description: 'Download gambar atau video Pinterest.',
  category: 'downloader',
  aliases: ['pin'],
  usage: 'pinterest <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.pinterest(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'auto' });
  },
};
