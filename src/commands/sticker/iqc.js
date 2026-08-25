import { replyWithProviderSticker } from '../../services/providers/media-response.js';

export const command = {
  name: 'iqc',
  description: 'Membuat IQC dari teks menggunakan Depay.',
  category: 'sticker',
  aliases: [],
  usage: 'iqc <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const response = await ctx.providers.depay.iqc(ctx.parsed.args.join(' '));
    await replyWithProviderSticker(ctx, response);
  },
};
