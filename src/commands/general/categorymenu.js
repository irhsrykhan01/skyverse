import { sendA2UICategoryMenu } from '../../platform/whatsapp/a2ui.js';

export const command = {
  name: 'categorymenu',
  description: 'Menampilkan menu command berdasarkan kategori A2UI.',
  category: 'system',
  permission: 'user',
  hidden: true,
  minArgs: 1,
  maxArgs: 1,
  usage: 'categorymenu <category>',
  async execute(ctx) {
    const category = String(ctx.parsed.args[0] ?? '').trim().toLowerCase();

    try {
      await sendA2UICategoryMenu(ctx.socket, ctx.chatId, {
        config: ctx.config,
        registry: ctx.registry,
        category,
      });
    } catch {
      await ctx.reply(`Kategori tidak tersedia: ${category}`);
    }
  },
};
