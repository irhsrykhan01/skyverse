import { replyWithProviderMedia } from '../../services/providers/media-response.js';

export const command = {
  name: 'iqc',
  description: 'Membuat IQC dengan fallback Deline → Nexray.',
  category: 'sticker',
  aliases: [],
  usage: 'iqc <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.makers.iqc(ctx.parsed.args.join(' '));
    await replyWithProviderMedia(ctx, response, 'image', null, { baseUrl: ctx.config.delineBaseUrl });
  },
};
