export const command = {
  name: 'tomp3',
  description: 'Mengubah audio atau video menjadi MP3 yang dapat diputar.',
  category: 'sticker',
  aliases: ['mp3'],
  usage: 'tomp3 (reply/kirim audio atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    const allowed = media.type === 'audio' || media.type === 'video' || (media.type === 'document' && /^(audio|video)\//i.test(media.mimetype));
    if (!allowed) throw new Error('tomp3 membutuhkan audio atau video.');
    const output = await ctx.media.toMp3(media.buffer);
    const isMp3 = Buffer.isBuffer(output) && output.length >= 64 && (
      output.subarray(0, 3).toString('ascii') === 'ID3' ||
      (output[0] === 0xff && (output[1] & 0xe0) === 0xe0)
    );
    if (!isMp3) throw new Error('Hasil MP3 tidak valid.');
    await ctx.media.send(output, 'audio', { mimetype: 'audio/mpeg', ptt: false });
  },
};
