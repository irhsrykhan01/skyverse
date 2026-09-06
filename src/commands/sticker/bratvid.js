export const command = {
  name: 'bratvid',
  description: 'Membuat stiker animasi Brat dari beberapa frame gambar.',
  category: 'sticker',
  aliases: [],
  usage: 'bratvid <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const text = ctx.parsed.args.join(' ').trim();
    const frames = await ctx.providers.makers.bratFrames(text);
    const animated = await ctx.media.toAnimatedStickerFromFrames(frames);
    await ctx.socket.sendMessage(ctx.chatId, { sticker: animated }, { quoted: ctx.message });
  },
};
