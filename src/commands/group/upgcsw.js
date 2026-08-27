export const command = {
  name: 'upgcsw',
  description: 'Mengirim Group Status menggunakan pesan yang direply atau teks.',
  category: 'group',
  aliases: [],
  usage: 'upgcsw [teks] (atau reply media)',
  permission: 'admin',
  minArgs: 0,
  maxArgs: null,
  cooldown: 3000,
  async execute(ctx) {
    if (!ctx.isGroup) throw new Error('Command ini hanya bisa dipakai di group.');

    const body = ctx.parsed.args.join(' ').trim();
    let statusContent = null;

    if (ctx.parsed.args.length) {
      statusContent = { text: body };
    } else {
      const resolved = await ctx.media.download();
      if (resolved?.type === 'image') {
        statusContent = { image: resolved.buffer, caption: resolved.node?.caption ?? '' };
      } else if (resolved?.type === 'video') {
        statusContent = { video: resolved.buffer, caption: resolved.node?.caption ?? '' };
      } else if (resolved?.type === 'audio') {
        statusContent = { audio: resolved.buffer };
      } else {
        throw new Error('Gunakan teks atau reply gambar/video/audio.');
      }
    }

    try {
      await ctx.socket.sendMessage(ctx.chatId, { groupStatusMessage: statusContent });
      await ctx.react('✅');
    } catch (error) {
      throw new Error(`Group Status tidak tersedia pada Baileys saat ini: ${error?.message ?? String(error)}`);
    }
  },
};
