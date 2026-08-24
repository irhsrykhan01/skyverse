export const command = {
  name: 'kick',
  description: 'Mengeluarkan anggota dari group.',
  category: 'group',
  aliases: [],
  usage: 'kick <nomor> / tag member',
  permission: 'admin',
  cooldown: 3000,
  async execute(ctx) {
    await ctx.group.kick(ctx);
    await ctx.reply('Permintaan kick member telah dikirim.');
  },
};
