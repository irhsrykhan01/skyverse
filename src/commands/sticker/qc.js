import { replyWithProviderMedia } from '../../services/providers/media-response.js';

export const command = {
  name: 'qc',
  description: 'Membuat quote card dari teks menggunakan Keyra.',
  category: 'sticker',
  aliases: ['quote'],
  usage: 'qc <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.keyra.quote(ctx.parsed.args.join(' '));
    await replyWithProviderMedia(ctx, response, 'image');
  },
};
