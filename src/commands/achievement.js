export const command = {
  name: 'achievement',
  description: 'Melihat Achievement SkyVerse.',
  category: 'general',
  aliases: ['ach'],
  usage: 'achievement',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    const list = ctx.progression.getAchievements(ctx.senderJid);
    const unlocked = list.filter((item) => item.unlocked).length;
    const lines = ['🏆 *SKYVERSE ACHIEVEMENT*', '', 'Progress: ' + unlocked + '/' + list.length, ''];
    for (const item of list) lines.push((item.unlocked ? '✅' : '🔒') + ' *' + item.name + '* — ' + item.description);
    await ctx.reply(lines.join('\n'));
  },
};
