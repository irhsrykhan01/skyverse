import { replyWithProviderMedia } from '../../services/providers/media-response.js';

export const command = {
  name: 'brat',
  description: 'Membuat stiker Brat dari teks.',
  category: 'sticker',
  aliases: [],
  usage: 'brat <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.keyra.brat(ctx.parsed.args.join(' '));
    await replyWithProviderMedia(ctx, response, 'image');
  },
};
