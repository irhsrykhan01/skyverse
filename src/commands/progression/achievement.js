export const command = {
  name: 'achievement',
  description: 'Melihat achievement SkyVerse yang sudah terbuka.',
  category: 'profile',
  access: 'npc',
  aliases: ['ach', 'achievements', 'prestasi'],
  usage: 'achievement',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    const list = ctx.progression.achievements(ctx.senderJid);
    const unlocked = list.filter((item) => item.unlocked).length;
    await ctx.reply([
      `🏆 *ACHIEVEMENT SKYVERSE* — ${unlocked}/${list.length}`,
      '',
      ...list.map((item) => `${item.unlocked ? '✅' : '🔒'} ${item.icon} *${item.name}*\n   ${item.description}`),
    ].join('\n'));
  },
};
