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

function getQuotedStanzaId(message) {
  return getContextInfo(message)?.stanzaId ?? null;
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
    try {
      if (ctx.isChannel) {
        const target = ctx.getNewsletterReplyTarget();
        if (!target?.messageId && !target?.serverId) {
          throw new Error('Reply pesan Channel yang ingin dihapus.');
        }

        // The newsletter service resolves server_id from the recent channel
        // message list when the incoming quoted envelope only exposes the
        // newsletter message_id.
        await ctx.newsletter.revoke(ctx, target);
        await ctx.react('✅');
        return;
      }

      const stanzaId = getQuotedStanzaId(ctx.message);
      if (!stanzaId) throw new Error('Reply pesan yang ingin dihapus.');

      const context = getContextInfo(ctx.message);
      const quotedParticipant = context?.participant ?? null;
      const ownUser = ctx.socket.user?.id ?? null;
      const normalize = (value) => String(value ?? '').split(':')[0].split('@')[0];
      const fromMe = Boolean(quotedParticipant && ownUser && normalize(quotedParticipant) === normalize(ownUser));

      await ctx.socket.sendMessage(ctx.chatId, {
        delete: {
          remoteJid: ctx.chatId,
          id: stanzaId,
          participant: quotedParticipant,
          fromMe,
        },
      });
      await ctx.react('✅');
    } catch (error) {
      const where = ctx.isChannel ? 'channel' : ctx.isGroup ? 'grup' : 'chat';
      throw new Error(`Pesan tidak bisa dihapus di ${where}: ${error?.message ?? String(error)}`);
    }
  },
};