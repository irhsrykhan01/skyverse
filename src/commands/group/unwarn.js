import { createGroupWarningService } from '../../services/group-warnings.js';
import { getGroupTarget } from '../../services/group-target.js';

export const command = {
  name: 'unwarn',
  description: 'Mengurangi satu peringatan anggota group.',
  category: 'group',
  aliases: [],
  usage: 'unwarn @member',
  permission: 'admin',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 2000,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const requestedTarget = getGroupTarget(ctx.message, ctx.parsed.args);
    if (!requestedTarget) throw new Error('Mention member yang ingin dikurangi warning-nya.');
    const metadata = await ctx.getGroupMetadata();
    const participant = metadata.participants?.find((item) =>
      [item.id, item.pn, item.lid].filter(Boolean).includes(requestedTarget)
    );
    if (!participant?.id) throw new Error('Target bukan anggota group.');

    const targetJid = participant.id;
    const targetPhoneJid = participant.pn
      ?? ([participant.id, participant.lid].find((jid) => String(jid ?? '').endsWith('@s.whatsapp.net')) ?? null);
    const targetNumber = targetPhoneJid ? String(targetPhoneJid).split('@')[0].replace(/\D/g, '') : null;
    const targetLabel = targetNumber ? `@${targetNumber} (+${targetNumber})` : 'anggota grup';
    const service = createGroupWarningService(ctx.repositories);
    const count = service.remove(ctx.chatId, targetJid);
    await ctx.reply(`✅ Warning dikurangi.\nTarget: ${targetLabel}\nJumlah tersisa: ${count}`, {
      sendOptions: { mentions: targetPhoneJid ? [targetPhoneJid] : [targetJid] },
    });
  },
};
