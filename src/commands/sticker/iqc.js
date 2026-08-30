import { replyWithProviderMedia } from '../../services/providers/media-response.js';

export const command = {
  name: 'iqc',
  description: 'Membuat IQC dari teks menggunakan Depay.',
  category: 'sticker',
  aliases: [],
  usage: 'iqc <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  cost: 10,
  async execute(ctx) {
    const response = await ctx.providers.depay.iqc(ctx.parsed.args.join(' '));
    // IQC is an image generator; send the generated image directly instead
    // of forcing it through sticker conversion, which can fail on large PNGs.
    await replyWithProviderMedia(ctx, response, 'image');
  },
};
