import { renderAllMenu } from '../../platform/whatsapp/allmenu-canvas.js';

export const command = {
  name: 'allmenu',
  description: 'Mengirim daftar seluruh command SkyVerse sebagai gambar.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'allmenu',
  cooldown: 5000,
  async execute(ctx) {
    const groups = ctx.registry.byCategory({ includeHidden: false });
    const commands = ctx.registry.all({ includeHidden: false });
    const image = renderAllMenu({
      botName: ctx.config.botName || 'SkyVerse',
      prefix: ctx.config.prefix,
      userName: ctx.message?.pushName || 'User',
      tier: ctx.user?.is_premium ? 'Premium User' : 'Free User',
      coins: Number(ctx.user?.coins ?? 0),
      groups,
      total: commands.length,
    });

    await ctx.media.send(image, 'image', {
      mimetype: 'image/png',
      caption: '☁️ SkyVerse • All Commands\nPilih command sesuai kategori. Gunakan .menu untuk membuka menu interaktif.',
    });
  },
};
