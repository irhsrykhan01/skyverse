export const command = {
  name: 'tagall',
  description: 'Mention seluruh anggota group dengan teks.',
  category: 'group',
  aliases: [],
  usage: 'tagall [teks]',
  permission: 'admin',
  cooldown: 5000,
  async execute(ctx) {
    await ctx.group.tagAll(ctx, ctx.parsed.args.join(' '));
  },
};
