import { sendA2UITest } from '../../platform/whatsapp/a2ui.js';

export const command = {
  name: 'a2uitest',
  description: 'Menguji Native Flow / A2UI interactive message SkyVerse.',
  category: 'general',
  aliases: ['a2ui'],
  permission: 'user',
  async execute(ctx) {
    try {
      await sendA2UITest(ctx.socket, ctx.chatId);
    } catch (error) {
      await ctx.reply(`A2UI test gagal: ${error?.message ?? String(error)}`);
    }
  },
};
