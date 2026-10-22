import { sendVisualDownload } from './_generic.js';

export const command = {
  name: 'twitter',
  description: 'Download media Twitter/X melalui Deline.',
  category: 'downloader',
  aliases: ['xdl'],
  usage: 'twitter <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.twitter(ctx.parsed.args[0]);
    await sendVisualDownload(ctx, response);
  },
};
