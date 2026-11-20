const TIME_ZONE = 'Asia/Jakarta';

export const command = {
  name: 'limit',
  description: 'Melihat sisa limit harian setiap fitur.',
  category: 'economy',
  access: 'npc',
  aliases: ['limits'],
  usage: 'limit',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 0,
  cost: 0,
  async execute(ctx) {
    if (ctx.isOwner) {
      await ctx.reply('FEATURE LIMIT\nStatus: Unlimited (Owner)\nSemua fitur bisa digunakan tanpa batas.');
      return;
    }

    const features = ctx.limits.snapshot(
      ctx.senderJid,
      ctx.registry.all({ includeHidden: false }),
    );
    if (!features.length) {
      await ctx.reply('Belum ada fitur yang menggunakan limit harian.');
      return;
    }

    const lines = [
      '╭─〔 *FEATURE LIMIT* 〕',
      '│ Reset: 00.00 WIB setiap hari',
      '├────────────────',
      ...features.map((item) => `│ .${item.name}: ${item.used}/${item.limit} • sisa ${item.remaining}`),
      '╰────────────────',
      `Default: ${new Intl.NumberFormat('id-ID').format(ctx.config.featureLimitDefault)} pemakaian per fitur/hari.`,
    ];
    await ctx.reply(lines.join('\n'));
  },
};
