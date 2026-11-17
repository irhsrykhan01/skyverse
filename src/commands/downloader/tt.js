import { normalizeTikTokUrl } from '../../services/providers/tiktok-url.js';

export const command = {
  name: 'tiktok',
  description: 'Download video TikTok tanpa watermark.',
  category: 'downloader',
  aliases: ['tt'],
  usage: 'tiktok <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = normalizeTikTokUrl(ctx.parsed.args[0]);
    const result = await ctx.providers.downloader.tiktokMedia(url, { kind: 'video' });
    await ctx.media.send(result.buffer, 'video', { mimetype: 'video/mp4' });
  },
};
