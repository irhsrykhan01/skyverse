import { createAfkService } from '../../services/afk.js';

export const command = {
  name: 'afk',
  description: 'Menandai diri sedang AFK.',
  category: 'general',
  aliases: [],
  usage: 'afk [alasan]',
  permission: 'user',
  minArgs: 0,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    const reason = ctx.parsed.args.join(' ').trim();
    const service = createAfkService(ctx.repositories);
    const state = service.set(ctx, reason);
    await ctx.reply(`✅ AFK aktif.${state.reason ? `\nAlasan: ${state.reason}` : ''}`);
  },
};
