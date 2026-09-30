export const command = {
  name: 'setbio',
  description: 'Mengatur bio profil SkyVerse.',
  category: 'general',
  aliases: ['bio'],
  usage: 'setbio <bio>',
  permission: 'user',
  minArgs: 1,
  maxArgs: null,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    const result = ctx.profile.setBio(ctx.senderJid, ctx.parsed.args.join(' '), {
      pushName: ctx.message?.pushName ?? null,
    });
    if (!result.ok) {
      await ctx.reply(`Bio terlalu panjang. Maksimal ${result.maxLength} karakter.`);
      return;
    }
    await ctx.reply(`✅ Bio diperbarui${result.bio ? `: ${result.bio}` : '.'}`);
  },
};
