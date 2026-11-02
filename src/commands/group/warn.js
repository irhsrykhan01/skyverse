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
    const requestedTarget = getGroupTarget(ctx.message, ctx.parsed.args);
    if (!requestedTarget) throw new Error('Mention member yang ingin diberi peringatan.');
    const metadata = await ctx.getGroupMetadata();
    const participant = metadata.participants?.find((item) =>
      [item.id, item.pn, item.lid].filter(Boolean).includes(requestedTarget)
    );
    if (!participant?.id) throw new Error('Target bukan anggota group.');

    const senderIds = new Set([ctx.senderJid, ctx.senderPhoneJid].filter(Boolean).map(String));
    if ([participant.id, participant.pn, participant.lid].filter(Boolean).some((jid) => senderIds.has(String(jid)))) {
      throw new Error('Kamu tidak bisa memberi warning ke diri sendiri.');
    }

    const targetJid = participant.id;
    const targetPhoneJid = participant.pn
      ?? ([participant.id, participant.lid].find((jid) => String(jid ?? '').endsWith('@s.whatsapp.net')) ?? null);
    const targetNumber = targetPhoneJid ? String(targetPhoneJid).split('@')[0].replace(/\D/g, '') : null;
    const targetLabel = targetNumber ? `@${targetNumber} (+${targetNumber})` : 'anggota grup';
    const reason = ctx.parsed.args.filter((item) => !String(item).includes('@')).join(' ').trim() || 'Tidak ada alasan';
    const service = createGroupWarningService(ctx.repositories);
    const count = service.add(ctx.chatId, targetJid);
    await ctx.reply(`⚠️ Warning diberikan.\nTarget: ${targetLabel}\nJumlah: ${count}\nAlasan: ${reason}`, {
      sendOptions: { mentions: targetPhoneJid ? [targetPhoneJid] : [targetJid] },
    });
  },
};
