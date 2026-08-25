import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'ttmp3',
  description: 'Mengambil audio dari TikTok.',
  category: 'downloader',
  aliases: [],
  usage: 'ttmp3 <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.tiktok(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'audio', filename: 'skyverse-tiktok.mp3' });
  },
};
