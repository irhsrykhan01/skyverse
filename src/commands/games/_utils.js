import { getMiniGame, startMiniGame } from '../../games/mini-games.js';

export async function canStartMiniGame(ctx) {
  const active = getMiniGame(ctx.senderJid, ctx.chatId);
  if (!active) return true;
  await ctx.reply('Masih ada game *' + active.type + '* yang aktif di chat ini. Semua anggota bisa ikut dengan me-reply pesan game tersebut. Tunggu sampai sesi berakhir sebelum memulai game baru.');
  return false;
}

export async function startGamePrompt(ctx, { type, answer = null, state = {}, text, expiresIn }) {
  const active = getMiniGame(ctx.senderJid, ctx.chatId);
  if (active) {
    await ctx.reply('Masih ada game *' + active.type + '* yang aktif di chat ini. Semua anggota bisa ikut dengan me-reply pesan game tersebut.');
    return false;
  }

  const promptText = ctx.isGroup
    ? text + '\n\n👥 Semua anggota grup boleh ikut! Setiap pemain punya kesempatan sendiri dan hadiah Coin masuk ke akun masing-masing.'
    : text;
  const sent = await ctx.socket.sendMessage(ctx.chatId, { text: promptText }, { quoted: ctx.message });
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
