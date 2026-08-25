export const command = {
  name: 'tovn',
  description: 'Mengubah audio atau video menjadi Voice Note WhatsApp yang valid.',
  category: 'sticker',
  aliases: ['vn'],
  usage: 'tovn (reply/kirim audio atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    const allowed = media.type === 'audio' || media.type === 'video' || (media.type === 'document' && /^(audio|video)\//i.test(media.mimetype));
    if (!allowed) throw new Error('tovn membutuhkan audio atau video.');
    const output = await ctx.media.toVoiceNote(media.buffer);
    if (!Buffer.isBuffer(output) || output.length < 64 || output.subarray(0, 4).toString('ascii') !== 'OggS') {
      throw new Error('Hasil Voice Note tidak valid.');
    }
    await ctx.media.send(output, 'audio', { mimetype: 'audio/ogg; codecs=opus', ptt: true });
  },
};
