import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';
import { toHd } from '../../services/media/index.js';

export const command = {
  name: 'brathd',
  description: 'Membuat Brat lalu meningkatkan resolusi 2x.',
  category: 'sticker',
  aliases: ['brat2x'],
  usage: 'brathd <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 4000,
  async execute(ctx) {
    const response = await ctx.providers.makers.brat(ctx.parsed.argumentText);
    const source = findMediaSource(response?.result ?? response, { baseUrl: ctx.config.delineBaseUrl });
    if (!source) throw new Error('Maker Brat tidak mengembalikan gambar.');
    const input = await downloadMediaSource(source, { expectedType: 'image' });
    const output = await toHd(input, { scale: 2 });
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg', caption: 'Brat HD • SkyVerse' });
  },
};
