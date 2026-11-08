import { createAntideleteService } from '../../services/antidelete.js';

export const command = {
  name: 'antidelete',
  description: 'Aktif/nonaktifkan anti-delete dan tentukan tujuan log.',
  category: 'group',
  aliases: [],
  usage: 'antidelete on|off [jid-log]',
  permission: 'admin',
  minArgs: 1,
  maxArgs: 2,
  cooldown: 1500,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const action = String(ctx.parsed.args[0]).toLowerCase();
    const service = createAntideleteService(ctx.repositories);

    if (action === 'on') {
      const destination = String(ctx.parsed.args[1] || ctx.chatId).trim();
      if (!destination.endsWith('@g.us')) {
        throw new Error('USER_INPUT:Tujuan log anti-delete hanya boleh berupa JID grup WhatsApp, bukan chat pribadi atau channel.');
      }

      let metadata;
      try {
        metadata = destination === ctx.chatId
          ? await ctx.getGroupMetadata()
          : await ctx.socket.groupMetadata(destination);
      } catch {
        throw new Error('USER_INPUT:Grup tujuan log tidak ditemukan atau bot belum tergabung di grup tersebut.');
      }

      const normalize = (jid) => String(jid ?? '').split(':')[0].toLowerCase();
      const botIds = new Set([ctx.socket.user?.id, ctx.socket.user?.pn, ctx.socket.user?.lid].filter(Boolean).map(normalize));
      const botIsMember = (metadata?.participants ?? []).some((participant) =>
        [participant?.id, participant?.pn, participant?.lid].filter(Boolean).some((jid) => botIds.has(normalize(jid)))
      );
      if (!botIsMember) {
        throw new Error('USER_INPUT:Bot harus menjadi anggota grup tujuan log terlebih dahulu.');
      }

      const value = service.set(ctx.chatId, { enabled: true, destination });
      await ctx.reply(`✅ Anti-delete aktif.\nHanya pesan baru di grup ini yang dicache sementara. Cache disimpan di memori dan akan hilang saat bot restart.\nTujuan log: ${value.destination === ctx.chatId ? 'grup ini' : value.destination}`);
      return;
    }

    if (action === 'off') {
      service.set(ctx.chatId, { enabled: false });
      await ctx.reply('✅ Anti-delete dinonaktifkan.');
      return;
    }

    if (action === 'status') {
      const value = service.get(ctx.chatId);
      await ctx.reply(`Anti-delete: ${value.enabled ? 'ON' : 'OFF'}\nTujuan: ${value.destination || 'group ini'}`);
      return;
    }

    throw new Error(`Gunakan ${ctx.config.prefix}antidelete on|off|status.`);
  },
};
