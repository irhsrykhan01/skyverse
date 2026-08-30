import { startBombGame, getBombGame } from '../../games/bomb.js';

const BOARD = '1️⃣ 2️⃣ 3️⃣
4️⃣ 5️⃣ 6️⃣
7️⃣ 8️⃣ 9️⃣';

export const command = {
  name: 'bomb',
  description: 'Memulai permainan Bomb 3x3.',
  category: 'games',
  aliases: [],
  usage: 'bomb',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  cost: 0,
  async execute(ctx) {
    if (getBombGame(ctx.senderJid)) {
      await ctx.reply('Kamu masih punya game Bomb yang sedang berjalan. Reply pesan game Bomb tersebut untuk lanjut.');
      return;
    }

    const sent = await ctx.socket.sendMessage(ctx.chatId, {
      text: ['💣 *BOMB GAME*', '', 'Pilih Angka di bawah ini untuk di buka isinya!.', '', BOARD, '', 'Ketikkan Angka dan Reply pesan ini.'].join('\n'),
    }, { quoted: ctx.message });

    if (!sent?.key?.id) {
      await ctx.reply('Game gagal dimulai karena pesan game tidak mendapatkan ID.');
      return;
    }

    startBombGame(ctx.senderJid, { chatId: ctx.chatId, gameMessageId: sent.key.id });
  },
};
