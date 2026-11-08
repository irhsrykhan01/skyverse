export const command = {
  name: 'kick',
  description: 'Mengeluarkan anggota biasa dari grup.',
  category: 'group',
  aliases: [],
  usage: 'kick <nomor> / tag anggota',
  permission: 'admin',
  cooldown: 3000,
  async execute(ctx) {
    const result = await ctx.group.kick(ctx);
    await ctx.reply(`✅ Berhasil mengeluarkan ${result.removed} anggota dari grup.`);
  },
};
