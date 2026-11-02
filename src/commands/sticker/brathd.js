export const command = {
  name: 'brathd',
  description: 'Mengirim hasil Brat API sebagai sticker.',
  category: 'sticker',
  aliases: ['brat2x'],
  usage: 'brathd <teks>',
  permission: 'user',
  minArgs: 1,
  cooldown: 4000,
  limitCost: 1,
  async execute(ctx) {
    const input = await ctx.providers.makers.brat(ctx.parsed.argumentText);
    if (!Buffer.isBuffer(input) || input.length < 16) {
      throw new Error('Maker API tidak mengembalikan gambar Brat yang valid.');
    }
    const sticker = await ctx.media.toSticker(input);
    await ctx.socket.sendMessage(ctx.chatId, { sticker }, { quoted: ctx.message });
  },
};
