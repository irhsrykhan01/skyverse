import { getMiniGame, startMiniGame } from '../../games/mini-games.js';

const REWARD_HINTS = Object.freeze({
  trivia: '🪙 Hadiah benar: 10–20 Coin.',
  benarsalah: '🪙 Hadiah benar: 5–12 Coin.',
  quizcepat: '🪙 Hadiah: 3–6 Coin untuk setiap jawaban benar.',
  susunkata: '🪙 Hadiah benar: 12–24 Coin.',
  tebakkata: '🪙 Hadiah benar: 12–24 Coin.',
  tebakemoji: '🪙 Hadiah benar: 10–20 Coin.',
  tebakangka: '🪙 Hadiah benar: 8–18 Coin.',
  rps: '🪙 Hadiah menang: 3–8 Coin.',
});

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

  const promptText = [
    text,
    REWARD_HINTS[type] || null,
    ctx.isGroup
      ? '👥 Semua anggota grup boleh ikut! Setiap pemain punya kesempatan sendiri dan hadiah Coin masuk ke akun masing-masing.'
      : null,
  ].filter(Boolean).join('\n\n');
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
