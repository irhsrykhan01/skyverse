import { sendDocumentDownload } from './_generic.js';

export const command = {
  name: 'mediafire',
  description: 'Download file MediaFire melalui Deline.',
  category: 'downloader',
  aliases: ['mf'],
  usage: 'mediafire <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.mediafire(ctx.parsed.args[0]);
    await sendDocumentDownload(ctx, response, 'skyverse-mediafire.bin');
  },
};
