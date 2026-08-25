import { createGroupWarningService } from '../../services/group-warnings.js';
import { getGroupTarget } from '../../services/group-target.js';

export const command = {
  name: 'warn',
  description: 'Memberi peringatan kepada anggota group dan menyimpannya secara persisten.',
  category: 'group',
  aliases: [],
  usage: 'warn @member [alasan]',
  permission: 'admin',
  minArgs: 1,
  maxArgs: null,
  cooldown: 2000,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const target = getGroupTarget(ctx.message, ctx.parsed.args);
    if (!target) throw new Error('Mention member yang ingin diberi peringatan.');
    const metadata = await ctx.getGroupMetadata();
    const participant = metadata.participants?.find((item) => [item.id, item.pn, item.lid].filter(Boolean).includes(target));
    if (!participant) throw new Error('Target bukan anggota group.');
    if ([participant.id, participant.pn, participant.lid].filter(Boolean).includes(ctx.senderJid)) throw new Error('Kamu tidak bisa memberi warning ke diri sendiri.');

    const reason = ctx.parsed.args.filter((item) => !String(item).includes('@')).join(' ').trim() || 'Tidak ada alasan';
    const service = createGroupWarningService(ctx.repositories);
    const count = service.add(ctx.chatId, target);
    await ctx.reply(`⚠️ Warning diberikan.\nTarget: @${target.split('@')[0]}\nJumlah: ${count}\nAlasan: ${reason}`, {
      sendOptions: { mentions: [target] },
    });
  },
};
