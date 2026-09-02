import { createRichMessage, sendRichMessage } from '../../platform/whatsapp/rich.js';
import { startTicTacToe, getTicTacToe } from '../../games/tictactoe.js';

export const command = {
  name: 'tictactoe', description: 'Memulai Tic-Tac-Toe Rich Message.', category: 'games', aliases: ['ttt'], usage: 'tictactoe', permission: 'user', minArgs: 0, maxArgs: 0, cooldown: 3000, cost: 0,
  async execute(ctx) {
    if (getTicTacToe(ctx.senderJid)) { await ctx.reply('Kamu masih punya permainan Tic-Tac-Toe. Selesaikan game sebelumnya dulu.'); return; }
    const rich=createRichMessage({
      htmlPayload:'<h1>🎮 TIC-TAC-TOE</h1><p>Pilih kotak untuk menaruh ❌.</p><p>SkyVerse vs kamu.</p>',
      text:'🎮 TIC-TAC-TOE\n\n1️⃣ 2️⃣ 3️⃣\n4️⃣ 5️⃣ 6️⃣\n7️⃣ 8️⃣ 9️⃣\n\nPilih kotak dengan reply angka 1-9 ke pesan ini.',
      trustedSources:['https://github.com/irhsrykhan01/skyverse'],
      actions:Array.from({length:9},(_,i)=>({text:String(i+1),id:'tictactoe:'+String(i+1)})),
    });
    const key=await sendRichMessage(ctx.socket,ctx.chatId,rich,{title:'SkyVerse • Tic-Tac-Toe',footer:'Reply angka 1-9 untuk bermain.',quote:ctx.message});
    startTicTacToe(ctx.senderJid,{chatId:ctx.chatId,gameMessageId:key?.id??null});
  },
};