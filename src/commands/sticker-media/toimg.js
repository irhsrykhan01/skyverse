export const command = {
  name: 'toimg',
  description: 'Mengubah sticker atau video menjadi gambar JPEG dari frame pertama.',
  category: 'sticker',
  aliases: ['toimage'],
  usage: 'toimg (reply sticker atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    const allowed = media.type === 'sticker' || media.type === 'video' || (media.type === 'document' && /^(image|video)\//i.test(media.mimetype));
    if (!allowed) throw new Error('toimg hanya menerima sticker atau video.');
    const output = await ctx.media.toImage(media.buffer);
    if (!Buffer.isBuffer(output) || output.length < 1024) throw new Error('Hasil gambar kosong atau terlalu kecil.');
    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg' });
  },
};
