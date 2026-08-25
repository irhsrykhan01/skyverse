export const command = {
  name: 'tovn',
  description: 'Mengubah audio/video menjadi Voice Note WhatsApp secara lokal.',
  category: 'sticker-media',
  aliases: ['vn'],
  usage: 'tovn (reply/kirim audio atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (!['audio', 'video', 'document'].includes(media.type)) throw new Error('tovn membutuhkan audio atau video.');
    const output = await ctx.media.toVoiceNote(media.buffer);
    await ctx.media.send(output, 'audio', { mimetype: 'audio/ogg; codecs=opus', ptt: true });
  },
};
