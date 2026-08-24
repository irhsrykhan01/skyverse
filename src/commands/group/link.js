export const command = {
  name: 'link',
  description: 'Mendapatkan link undangan group.',
  category: 'group',
  aliases: [],
  usage: 'link',
  permission: 'admin',
  cooldown: 2000,
  async execute(ctx) {
    const link = await ctx.group.inviteLink(ctx);
    await ctx.reply(`Link Group:\n${link}`);
  },
};
