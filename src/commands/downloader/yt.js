import { replyWithDownloaderMedia } from '../../services/providers/downloader-response.js';
import { sendWithFallback } from './_generic.js';

export const command = {
  name: 'youtube',
  description: 'Download video YouTube.',
  category: 'downloader',
  aliases: ['yt'],
  usage: 'youtube <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = ctx.parsed.args[0];
    await sendWithFallback(ctx, [
      { name: 'Siputzx', run: () => ctx.providers.siputzx.youtube(url) },
      { name: 'Deline', run: () => ctx.providers.deline.youtube(url) },
      { name: 'Zenzxz', run: () => ctx.providers.zenzxz.youtube(url) },
      { name: 'Vreden', run: () => ctx.providers.vreden.youtube(url) },
    ], (response) => replyWithDownloaderMedia(ctx, response, { kind: 'video' }));
  },
};
