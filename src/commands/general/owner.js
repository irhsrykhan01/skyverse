export const command = {
  name: 'owner',
  description: 'Mengirim kartu kontak pemilik SkyVerse.',
  category: 'general',
  aliases: ['creator'],
  permission: 'user',
  async execute(ctx) {
    const number = String(ctx.config.ownerNumber ?? '').replace(/\D/g, '');
    if (!number) {
      await ctx.reply('Owner belum dikonfigurasi. Isi OWNER_NUMBER pada environment SkyVerse.');
      return;
    }

    const international = number.startsWith('0') ? `62${number.slice(1)}` : number;
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Owner SkyLabs',
      `TEL;type=CELL;type=VOICE;waid=${international}:+${international}`,
      'END:VCARD',
    ].join('\n');

    await ctx.socket.sendMessage(ctx.chatId, {
      contacts: {
        displayName: 'Owner SkyLabs',
        contacts: [{ vcard }],
      },
    }, { quoted: ctx.message });
  },
};
