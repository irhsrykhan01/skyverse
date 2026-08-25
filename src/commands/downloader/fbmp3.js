import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'fbmp3',
  description: 'Mengambil audio dari Facebook.',
  category: 'downloader',
  aliases: [],
  usage: 'fbmp3 <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.facebook(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'audio', filename: 'skyverse-facebook.mp3' });
  },
};
