export const command = {
  name: 'upch',
  description: 'Mengirim teks, media, atau sound sticker yang dibalas ke Channel tersimpan.',
  category: 'system',
  hidden: true,
  aliases: ['uploadchannel', 'tosaluran'],
  usage: 'upch [teks] (atau reply pesan/media)',
  permission: 'user',
  minArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    await ctx.newsletter.upload(ctx, ctx.parsed.args.join(' '));
    await ctx.reply('Berhasil dikirim ke WhatsApp Channel.');
  },
};
