import { normalizeMessageContent } from '@whiskeysockets/baileys';

function getContextInfo(message) {
  const content = normalizeMessageContent(message?.message ?? message);
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.audioMessage?.contextInfo
    ?? content?.stickerMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? content?.ptvMessage?.contextInfo
    ?? null;
}

function sameUser(a, b) {
  if (!a || !b) return false;
  const normalize = (value) => String(value).split(':')[0].split('@')[0];
  return normalize(a) === normalize(b);
}

function getQuotedKey(ctx) {
  const context = getContextInfo(ctx.message);
  if (!context?.stanzaId) return null;

  const quotedParticipant = context.participant ?? null;
  const ownUser = ctx.socket.user?.id ?? null;
  const fromMe = sameUser(quotedParticipant, ownUser);
  const key = {
    remoteJid: ctx.chatId,
    id: context.stanzaId,
    participant: quotedParticipant,
    fromMe,
  };

  // Newsletter messages use a server-side message id. In a Channel,
  // stanzaId is the value exposed by the quoted-message envelope and must
  // also be carried as server_id; using only a normal chat key is rejected.
  if (ctx.isChannel) {
    key.server_id = context.stanzaId;
    delete key.participant;
  }

  return key;
}

export const command = {
  name: 'delete',
  description: 'Menghapus pesan yang kamu reply jika WhatsApp mengizinkannya.',
  category: 'general',
  aliases: ['del'],
  usage: 'delete (reply pesan)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 1500,
  async execute(ctx) {
    const key = getQuotedKey(ctx);
    if (!key) throw new Error('Reply pesan yang ingin dihapus.');

    try {
      await ctx.socket.sendMessage(ctx.chatId, { delete: key });
      await ctx.react('✅');
    } catch (error) {
      const where = ctx.isChannel ? 'channel' : ctx.isGroup ? 'grup' : 'chat';
      throw new Error(`Pesan tidak bisa dihapus di ${where}: ${error?.message ?? String(error)}`);
    }
  },
};
