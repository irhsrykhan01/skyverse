export const command = {
  name: 'hidetag',
  description: 'Mention seluruh anggota tanpa menampilkan daftar mention.',
  category: 'group',
  aliases: [],
  usage: 'hidetag [teks]',
  permission: 'admin',
  cooldown: 5000,
  async execute(ctx) {
    await ctx.group.hideTag(ctx, ctx.parsed.args.join(' '));
  },
};
