export const command = {
  name: 'tomp3',
  description: 'Mengubah audio atau video menjadi MP3 yang kompatibel.',
  category: 'sticker',
  aliases: ['mp3'],
  usage: 'tomp3 (reply/kirim audio atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['audio', 'video', 'document'].includes(media.type)) {
      throw new Error('tomp3 membutuhkan audio atau video.');
    }
    const output = await ctx.media.toMp3(media.buffer);
    await ctx.media.send(output, 'audio', {
      mimetype: 'audio/mpeg',
      ptt: false,
    });
  },
};
