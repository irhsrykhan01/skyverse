import { sendDocumentDownload } from './_generic.js';

export const command = {
  name: 'gdrive',
  description: 'Download file Google Drive melalui Deline.',
  category: 'downloader',
  aliases: ['googledrive'],
  usage: 'gdrive <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.googleDrive(ctx.parsed.args[0]);
    await sendDocumentDownload(ctx, response, 'skyverse-gdrive.bin');
  },
};
