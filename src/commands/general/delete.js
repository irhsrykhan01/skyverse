import { normalizeMessageContent } from '@whiskeysockets/baileys';

function getQuotedKey(message) {
  const content = normalizeMessageContent(message?.message ?? message);
  const context = content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? content?.audioMessage?.contextInfo
    ?? null;
  if (!context?.stanzaId) return null;
  return {
    remoteJid: message.key?.remoteJid,
    id: context.stanzaId,
    participant: context.participant,
    fromMe: false,
  };
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
    const key = getQuotedKey(ctx.message);
    if (!key) throw new Error('Reply pesan yang ingin dihapus.');
    try {
      await ctx.socket.sendMessage(ctx.chatId, { delete: key });
      await ctx.react('✅');
    } catch (error) {
      throw new Error(`Pesan tidak bisa dihapus: ${error?.message ?? String(error)}`);
    }
  },
};
