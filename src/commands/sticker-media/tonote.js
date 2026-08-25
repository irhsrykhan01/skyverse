export const command = {
  name: 'tonote',
  description: 'Mengubah video menjadi Video Note (video bulat) WhatsApp.',
  category: 'media',
  aliases: ['videonote'],
  usage: 'tonote (reply video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    const media = await ctx.media.download();
    if (media.type !== 'video') {
      throw new Error('Reply video yang ingin dijadikan Video Note.');
    }

    const output = await ctx.media.toVideo(media.buffer, {
      sourceType: 'video',
      videoNote: true,
      maxDuration: 60,
    });

    if (!Buffer.isBuffer(output) || output.length < 1024) {
      throw new Error('Hasil Video Note kosong atau terlalu kecil.');
    }

    await ctx.media.send(output, 'video', {
      mimetype: 'video/mp4',
      videoNote: true,
    });
  },
};
