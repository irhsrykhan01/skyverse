export const command = {
  name: 'sticker',
  description: 'Mengubah gambar menjadi sticker dan video bersuara menjadi sound sticker.',
  category: 'sticker',
  aliases: ['s'],
  usage: 'sticker (reply/kirim gambar atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['image', 'video'].includes(media.type)) throw new Error('Sticker hanya mendukung gambar atau video.');
    if (media.type === 'image') {
      const output = await ctx.media.toSticker(media.buffer);
      await ctx.media.send(output, 'sticker');
      return;
    }
    const output = await ctx.media.toSoundSticker(media.buffer);
    if (output.audio) {
      await ctx.media.sendSoundSticker(output.sticker, output.audio);
      if (output.trimmed) await ctx.reply(`Durasi sound sticker disesuaikan menjadi ${output.seconds.toFixed(1)} detik agar ukuran tetap di bawah 500 KB dan kualitas visual terjaga.`);
    } else await ctx.media.send(output.sticker, 'sticker');
  },
};
