import { createGroupWarningService } from '../../services/group-warnings.js';
import { getGroupTarget } from '../../services/group-target.js';

export const command = {
  name: 'warnings',
  description: 'Melihat jumlah warning anggota group.',
  category: 'group',
  aliases: [],
  usage: 'warnings @member',
  permission: 'admin',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 1000,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const target = getGroupTarget(ctx.message, ctx.parsed.args);
    if (!target) throw new Error('Mention member yang ingin dicek.');
    const metadata = await ctx.getGroupMetadata();
    const participant = metadata.participants?.find((item) => [item.id, item.pn, item.lid].filter(Boolean).includes(target));
    if (!participant) throw new Error('Target bukan anggota group.');
    const service = createGroupWarningService(ctx.repositories);
    const count = service.get(ctx.chatId, target);
    await ctx.reply(`⚠️ Warning member\nTarget: @${target.split('@')[0]}\nJumlah: ${count}`, {
      sendOptions: { mentions: [target] },
    });
  },
};
