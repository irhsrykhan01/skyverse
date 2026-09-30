export const command = {
  name: 'quest',
  description: 'Melihat dan mengambil hadiah Daily Quest SkyVerse.',
  category: 'profile',
  access: 'npc',
  aliases: ['quests', 'misi', 'mission'],
  usage: 'quest [claim <id>]',
  permission: 'user',
  minArgs: 0,
  maxArgs: 2,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    if (ctx.args[0]?.toLowerCase() === 'claim') {
      const questId = ctx.args[1];
      if (!questId) throw new Error('Gunakan: quest claim <id>.');
      const result = ctx.progression.claimQuest(ctx.senderJid, questId);
      if (!result.ok) {
        const messages = {
          unknown_quest: 'Quest tidak ditemukan.',
          not_completed: `Quest belum selesai. Progress: ${result.progress}/${result.quest.target}.`,
          already_claimed: 'Reward quest ini sudah diambil hari ini.',
        };
        await ctx.reply(messages[result.reason] ?? 'Quest belum bisa di-claim.');
        return;
      }
      const coinResult = ctx.economy.addCoins(ctx.senderJid, result.coins, `quest:${result.quest.id}`);
      const xpAdded = result.xpResult?.added ?? 0;
      await ctx.reply([
        '🎯 *QUEST SELESAI!*',
        `${result.quest.name}`,
        `+${result.coins} 🪙`,
        `+${xpAdded} XP ✨`,
        result.xpResult?.leveledUp ? `🎉 Level Up → Lv.${result.xpResult.level} ${result.xpResult.title}` : '',
        coinResult != null ? `🪙 Saldo: ${ctx.economy.format(coinResult)}` : '',
      ].filter(Boolean).join('\n'));
      return;
    }

    const quests = ctx.progression.quests(ctx.senderJid);
    await ctx.reply([
      '🎯 *DAILY QUEST SKYVERSE*',
      '',
      ...quests.map((quest) => `${quest.completed ? (quest.claimed ? '✅' : '🎁') : '▫️'} *${quest.name}* [${quest.id}]\n   ${quest.description}\n   Progress: ${quest.progress}/${quest.target} · +${quest.xp} XP · +${quest.coins} 🪙`),
      '',
      'Claim: `.quest claim <id>`',
    ].join('\n'));
  },
};
