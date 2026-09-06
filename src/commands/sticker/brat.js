import { replyWithProviderSticker } from '../../services/providers/media-response.js';

export const command = {
  name: 'brat',
  description: 'Membuat stiker Brat dari teks menggunakan aqul-brat.',
  category: 'sticker',
  aliases: [],
  usage: 'brat <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.makers.brat(ctx.parsed.args.join(' '));
    await replyWithProviderSticker(ctx, response, { baseUrl: ctx.config.bratBaseUrl });
  },
};
