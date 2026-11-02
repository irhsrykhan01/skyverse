import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';
import { sendWithFallback } from './_generic.js';

export const command = {
  name: 'facebook',
  description: 'Download media Facebook.',
  category: 'downloader',
  aliases: ['fb'],
  usage: 'facebook <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'Deline', run: () => ctx.providers.deline.facebook(url) },
      { name: 'Zenzxz', run: () => ctx.providers.zenzxz.facebook(url) },
    ], (response) => replyWithDownloaderMedia(ctx, response, { kind: 'video' }));
  },
};
