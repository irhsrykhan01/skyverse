export const command = {
  name: 'upch',
  description: 'Mengirim teks atau pesan yang dibalas ke Channel tersimpan.',
  category: 'system',
  hidden: true,
  aliases: ['uploadchannel'],
  usage: 'upch [teks] (atau reply pesan)',
  permission: 'user',
  minArgs: 0,
  cooldown: 5000,
  async execute(ctx) {
    await ctx.newsletter.upload(ctx, ctx.parsed.args.join(' '));
  },
};
