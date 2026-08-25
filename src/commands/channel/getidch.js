export const command = {
  name: 'getidch',
  description: 'Mengambil ID dan metadata WhatsApp Channel.',
  category: 'system',
  aliases: ['channelid'],
  usage: 'getidch [link/JID]',
  permission: 'user',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const reference = ctx.parsed.args[0];
    const metadata = reference
      ? await ctx.newsletter.resolve(ctx, reference)
      : await ctx.newsletter.getCurrentChannel(ctx);

    const lines = [
      '*WhatsApp Channel*',
      `Name: ${metadata.name}`,
      `JID: ${metadata.id}`,
      `Invite: ${metadata.invite ? `https://whatsapp.com/channel/${metadata.invite}` : '-'}`,
      `Subscribers: ${metadata.subscribers || '-'}`,
      `Role: ${metadata.role ?? 'UNKNOWN'}`,
      '',
      `Gunakan ${ctx.config.prefix}setchannel ${metadata.id}`,
    ];
    await ctx.reply(lines.join('\n'));
  },
};
