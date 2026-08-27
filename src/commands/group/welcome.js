export const command = {
  name: 'welcome',
  description: 'Mengatur pesan welcome group.',
  category: 'group',
  aliases: [],
  usage: 'welcome on|off|set <teks>',
  permission: 'admin',
  minArgs: 1,
  maxArgs: null,
  cooldown: 1500,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');
    const action = String(ctx.parsed.args[0]).toLowerCase();

    if (action === 'on' || action === 'off') {
      const current = ctx.repositories.settings.get('group', ctx.chatId, 'group.welcome', null);
      let settings = {};
      try { settings = current ? JSON.parse(current) : {}; } catch {}
      settings.enabled = action === 'on';
      settings.text ||= 'Selamat datang di *{group}*, @user!';
      ctx.repositories.settings.set('group', ctx.chatId, 'group.welcome', JSON.stringify(settings));
      await ctx.reply(`✅ Welcome ${settings.enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
      return;
    }

    if (action === 'set') {
      const text = ctx.parsed.args.slice(1).join(' ').trim();
      if (!text) throw new Error(`Contoh: ${ctx.config.prefix}welcome set Selamat datang @user di {group}!`);
      ctx.repositories.settings.set('group', ctx.chatId, 'group.welcome', JSON.stringify({ enabled: true, text }));
      await ctx.reply('✅ Pesan welcome berhasil disimpan.');
      return;
    }

    throw new Error(`Gunakan ${ctx.config.prefix}welcome on|off|set <teks>.`);
  },
};
