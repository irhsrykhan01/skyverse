import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

export const command = {
  name: 'menu',
  description: 'Menampilkan menu interaktif SkyVerse.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    try {
      await sendA2UIMenu(ctx.socket, ctx.chatId, ctx);
    } catch {
      await ctx.reply('Menu interaktif gagal dikirim. Coba lagi.');
    }
  },
};
