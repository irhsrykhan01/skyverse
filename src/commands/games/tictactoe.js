import { renderTicTacToe } from '../../platform/whatsapp/tictactoe-canvas.js';
import { startTicTacToe, getTicTacToe, playTicTacToe, surrenderTicTacToe } from '../../games/tictactoe.js';

function getMentions(message) {
  const content = message?.message ?? message;
  const context = content?.extendedTextMessage?.contextInfo ?? content?.imageMessage?.contextInfo ?? content?.videoMessage?.contextInfo ?? null;
  return Array.isArray(context?.mentionedJid) ? context.mentionedJid.filter(Boolean).map(String) : [];
}

function statusText(game, result = null) {
  if (result === 'draw') return '🤝 SERI';
  if (result === 'X') return '🏆 PLAYER 1 MENANG';
  if (result === 'O') return '🏆 PLAYER 2 MENANG';
  if (result === 'surrender') return '🏳️ PERMAINAN BERAKHIR';
  return game.turn === game.player1 ? '🎯 GILIRAN PLAYER 1 • ❌' : '🎯 GILIRAN PLAYER 2 • ⭕';
}

async function sendBoard(ctx, game, { result = null } = {}) {
  const image = renderTicTacToe(game.board, { statusText: statusText(game, result) });
  const caption = [
    '🎮 *TIC-TAC-TOE*',
    '',
    `❌ Player 1: @${String(game.player1).split('@')[0]}`,
    `⭕ Player 2: @${String(game.player2).split('@')[0]}`,
    '',
    statusText(game, result),
    '',
    result ? 'Game selesai.' : 'Pilih kotak dengan *.tictactoe 1* sampai *.tictactoe 9*',
    result ? '' : 'Menyerah: *.tictactoe menyerah*',
  ].join('\n');
  return ctx.socket.sendMessage(ctx.chatId, { image, caption, mentions: [game.player1, game.player2] }, { quoted: ctx.message });
}

export const command = {
  name: 'tictactoe',
  description: 'Tic-Tac-Toe multiplayer dengan papan Node-Canvas.',
  category: 'games',
  aliases: ['ttt', 'pasang', 'surrender'],
  usage: 'tictactoe @user | tictactoe <1-9> | tictactoe menyerah',
  permission: 'user',
  minArgs: 0,
  maxArgs: 1,
  cooldown: 1000,
  cost: 0,
  async execute(ctx) {
    const args = ctx.parsed.args ?? [];
    const action = String(args[0] ?? '').trim().toLowerCase();
    const current = getTicTacToe(ctx.chatId);

    if (action === 'menyerah' || action === 'surrender' || ctx.parsed.name === 'surrender') {
      const result = surrenderTicTacToe(ctx.chatId, ctx.senderJid);
      if (!result.ok) {
        await ctx.reply(result.reason === 'not_player' ? 'Kamu bukan pemain dalam game ini.' : 'Tidak ada game Tic-Tac-Toe yang sedang berlangsung.');
        return;
      }
      await sendBoard(ctx, result.game, { result: 'surrender' });
      return;
    }

    if (!current) {
      const opponent = getMentions(ctx.message).find((jid) => jid !== ctx.senderJid) ?? null;
      if (!opponent) {
        await ctx.reply('Untuk memulai game, gunakan *.tictactoe @user* atau *.ttt @user*.');
        return;
      }
      const game = startTicTacToe(ctx.chatId, { player1: ctx.senderJid, player2: opponent });
      await sendBoard(ctx, game);
      return;
    }

    if (!/^[1-9]$/.test(action)) {
      await ctx.reply('Game sedang berlangsung. Pilih posisi dengan *.tictactoe 1* sampai *.tictactoe 9*, atau *.tictactoe menyerah*.');
      return;
    }

    const result = playTicTacToe(ctx.chatId, ctx.senderJid, action);
    if (!result.ok) {
      const messages = {
        not_player: 'Kamu bukan pemain dalam game ini.',
        not_your_turn: 'Bukan giliran kamu.',
        occupied: 'Kotak itu sudah terisi. Pilih kotak lain.',
        invalid: 'Posisi harus 1 sampai 9.',
        not_started: 'Tidak ada game Tic-Tac-Toe yang sedang berlangsung.',
      };
      await ctx.reply(messages[result.reason] ?? 'Gerakan tidak dapat diproses.');
      return;
    }

    await sendBoard(ctx, result.game, { result: result.result });
  },
};
