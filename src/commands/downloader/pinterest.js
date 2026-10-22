import { sendVisualDownload } from './_generic.js';

export const command = {
  name: 'pinterest',
  description: 'Download media Pinterest melalui Deline.',
  category: 'downloader',
  aliases: ['pin'],
  usage: 'pinterest <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.pinterest(ctx.parsed.args[0]);
    await sendVisualDownload(ctx, response);
  },
};
