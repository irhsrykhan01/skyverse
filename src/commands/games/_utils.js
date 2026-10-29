import { getMiniGame, startMiniGame } from '../../games/mini-games.js';

export async function canStartMiniGame(ctx) {
  const active = getMiniGame(ctx.senderJid, ctx.chatId);
  if (!active) return true;
  await ctx.reply('Kamu masih punya game ' + active.type + ' yang aktif. Selesaikan lewat reply pesan game itu dulu ya.');
  return false;
}

export async function startGamePrompt(ctx, { type, answer = null, state = {}, text, expiresIn }) {
  const active = getMiniGame(ctx.senderJid, ctx.chatId);
  if (active) {
    await ctx.reply('Kamu masih punya game ' + active.type + ' yang aktif. Selesaikan lewat reply pesan game itu dulu ya.');
    return false;
  }

  const sent = await ctx.socket.sendMessage(ctx.chatId, { text }, { quoted: ctx.message });
  if (!sent?.key?.id) {
    await ctx.reply('Game gagal dimulai karena pesan game tidak mendapatkan ID.');
    return false;
  }

  startMiniGame({
    userId: ctx.senderJid,
    chatId: ctx.chatId,
    gameMessageId: sent.key.id,
    type,
    answer,
    state,
    expiresIn,
  });
  return true;
}
