export const command = {
  name: 'add',
  description: 'Menambahkan anggota ke group.',
  category: 'group',
  aliases: [],
  usage: 'add <nomor> / tag member',
  permission: 'admin',
  minArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    await ctx.group.add(ctx);
    await ctx.reply('Permintaan add member telah dikirim.');
  },
};
