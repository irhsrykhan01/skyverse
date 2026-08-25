export const command = {
  name: 'setchannel',
  description: 'Menyimpan WhatsApp Channel untuk akun pengguna ini.',
  category: 'system',
  aliases: ['setch'],
  usage: 'setchannel <link/JID>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const metadata = await ctx.newsletter.resolve(ctx, ctx.parsed.args[0]);
    await ctx.newsletter.setSaved(ctx, metadata);
    await ctx.reply([
      '*Channel berhasil disimpan.*',
      `Name: ${metadata.name}`,
      `JID: ${metadata.id}`,
      `Role: ${metadata.role ?? 'UNKNOWN'}`,
      '',
      `Sekarang ${ctx.config.prefix}upch dapat digunakan untuk mengirim ke channel ini.`,
    ].join('\n'));
  },
};
