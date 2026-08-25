import { replyWithProviderSticker } from '../../services/providers/media-response.js';

export const command = {
  name: 'bratvid',
  description: 'Membuat stiker animasi Brat dari teks.',
  category: 'sticker',
  aliases: [],
  usage: 'bratvid <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.keyra.bratVideo(ctx.parsed.args.join(' '));
    await replyWithProviderSticker(ctx, response, { animated: true });
  },
};
