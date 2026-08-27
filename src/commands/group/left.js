export const command = {
  name: 'left',
  description: 'Mengatur pesan ketika member keluar/dikeluarkan.',
  category: 'group',
  aliases: [],
  usage: 'left on|off|set <teks>',
  permission: 'admin',
  minArgs: 1,
  maxArgs: null,
  cooldown: 1500,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const action = String(ctx.parsed.args[0]).toLowerCase();

    if (action === 'on' || action === 'off') {
      const current = ctx.repositories.settings.get('group', ctx.chatId, 'group.left', null);
      let settings = {};
      try { settings = current ? JSON.parse(current) : {}; } catch {}
      settings.enabled = action === 'on';
      settings.text ||= 'Sampai jumpa dari *{group}*, @user!';
      ctx.repositories.settings.set('group', ctx.chatId, 'group.left', JSON.stringify(settings));
      await ctx.reply(`✅ Left ${settings.enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
      return;
    }

    if (action === 'set') {
      const text = ctx.parsed.args.slice(1).join(' ').trim();
      if (!text) throw new Error(`Contoh: ${ctx.config.prefix}left set Dadah @user!`);
      ctx.repositories.settings.set('group', ctx.chatId, 'group.left', JSON.stringify({ enabled: true, text }));
      await ctx.reply('✅ Pesan left berhasil disimpan.');
      return;
    }

    throw new Error(`Gunakan ${ctx.config.prefix}left on|off|set <teks>.`);
  },
};
