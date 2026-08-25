import { createQrProvider } from '../../services/providers/qrkit.js';

const qr = createQrProvider();

export const command = {
  name: 'texttoqr',
  description: 'Mengubah teks atau URL menjadi gambar QR.',
  category: 'tools',
  aliases: [],
  usage: 'texttoqr <teks atau URL>',
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 2000,
  async execute(ctx) {
    const data = ctx.parsed.args.join(' ');
    const output = await qr.generate(data, { size: 512, format: 'png', ecc: 'H' });
    await ctx.media.send(output, 'image', { mimetype: 'image/png', caption: 'SkyVerse QR' });
  },
};
