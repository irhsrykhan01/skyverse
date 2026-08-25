import { replyWithProviderMedia } from '../../services/providers/media-response.js';

export const command = {
  name: 'iqc',
  description: 'Membuat quote sticker dari teks menggunakan Keyra.',
  category: 'sticker',
  aliases: [],
  usage: 'iqc <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.keyra.iqc(ctx.parsed.args.join(' '));
    await replyWithProviderMedia(ctx, response, 'image');
  },
};
