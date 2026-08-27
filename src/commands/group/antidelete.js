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
      const destination = ctx.parsed.args[1] || ctx.chatId;
      const value = service.set(ctx.chatId, { enabled: true, destination });
      await ctx.reply(`✅ Anti-delete aktif.\nTujuan log: ${value.destination === ctx.chatId ? 'group ini' : value.destination}`);
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
