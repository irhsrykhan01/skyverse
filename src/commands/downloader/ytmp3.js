import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';

export const command = {
  name: 'ytmp3',
  description: 'Download audio MP3 dari YouTube.',
  category: 'downloader',
  aliases: [],
  usage: 'ytmp3 <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.youtubeMp3(ctx.parsed.args[0]);
    await replyWithDownloaderMedia(ctx, response, { kind: 'audio', filename: 'skyverse-youtube.mp3' });
  },
};
