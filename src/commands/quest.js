import { formatCoins } from '../economy/config.js';

function formatQuest(quest) {
  const status = quest.claimed ? '✅ Claimed' : quest.completed ? '🎁 Siap diambil' : '⏳ Berjalan';
  return '• *' + quest.name + '* — ' + quest.progress + '/' + quest.target + ' ' + status + '\n  ' + quest.description + '\n  Reward: ' + formatCoins(quest.rewardCoins) + ' + ' + quest.rewardXp + ' XP';
}

export const command = {
  name: 'quest',
  description: 'Melihat dan mengambil Daily Quest.',
  category: 'general',
  aliases: ['misi'],
  usage: 'quest [claim <id>]',
  permission: 'user',
  minArgs: 0,
  maxArgs: 2,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    if (ctx.parsed.args[0]?.toLowerCase() === 'claim') {
      const id = ctx.parsed.args[1];
      if (!id) return ctx.reply('Format: ' + ctx.config.prefix + 'quest claim <id>');
      const result = ctx.progression.claimQuest(ctx.senderJid, id);
      if (!result.ok) {
        const messages = { unknown_quest: 'ID quest tidak ditemukan.', not_completed: 'Quest itu belum selesai.', already_claimed: 'Reward quest itu sudah diambil.', balance_limit: 'Reward Coin tidak bisa ditambahkan karena saldo mencapai batas.' };
        return ctx.reply(messages[result.reason] ?? 'Quest gagal di-claim.');
      }
      return ctx.reply(['🎁 *QUEST REWARD*', 'Quest: ' + result.quest.name, '+' + formatCoins(result.coins), '+' + result.xp + ' XP', 'Level: ' + result.level].join('\n'));
    }
    const quests = ctx.progression.getQuests(ctx.senderJid);
    await ctx.reply(['📜 *DAILY QUEST*', '', ...quests.map(formatQuest), '', 'Claim: ' + ctx.config.prefix + 'quest claim <id>'].join('\n'));
  },
};
