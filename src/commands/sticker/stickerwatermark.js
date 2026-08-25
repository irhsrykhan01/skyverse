import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { addExif } from '../../services/media/sticker-metadata.js';

export const command = {
  name: 'stickerwatermark',
  description: 'Mengubah nama pack dan author sticker tanpa mengubah gambarnya.',
  category: 'sticker',
  aliases: ['swm'],
  usage: 'stickerwatermark <pack> | <author> (reply sticker)',
  examples: ['stickerwatermark SkyVerse | rashii', 'stickerwatermark SkyVerse'],
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const raw = ctx.parsed.args.join(' ').trim();
    if (!raw) throw new Error('Masukkan nama pack. Contoh: stickerwatermark SkyVerse | rashii');
    const [pack = '', author = 'SkyVerse'] = raw.split('|', 2).map((value) => value.trim());
    if (!pack) throw new Error('Nama pack tidak boleh kosong.');
    const media = await ctx.media.download();
    if (media.type !== 'sticker') throw new Error('Reply sticker yang ingin diubah metadata-nya.');
    await ctx.react('⏳');
    try {
      const output = await addExif(media.buffer, {
        packname: pack.slice(0, 100),
        author: (author || 'SkyVerse').slice(0, 100),
      });
      await ctx.media.send(output, 'sticker');
      await ctx.react('☑️');
    } catch (error) {
      await ctx.react('❌');
      throw error;
    }
  },
};
