export const command = {
  name: 'hd',
  description: 'Meningkatkan resolusi gambar 2x atau 4x secara lokal.',
  category: 'tools',
  aliases: ['upscale'],
  usage: 'hd [2|4] (reply/kirim gambar)',
  examples: ['hd', 'hd 4'],
  permission: 'user',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'image') throw new Error('HD membutuhkan gambar.');
    const scale = Number(ctx.parsed.args[0] ?? 2);
    const output = await ctx.media.toHd(media.buffer, { scale });
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg', caption: `SkyVerse HD ${scale}x` });
  },
};
