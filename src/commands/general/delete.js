import { normalizeMessageContent } from '@whiskeysockets/baileys';

function getContextInfo(message) {
  const normalized = normalizeMessageContent(message?.message ?? message);
  return normalized?.extendedTextMessage?.contextInfo
    ?? normalized?.imageMessage?.contextInfo
    ?? normalized?.videoMessage?.contextInfo
    ?? normalized?.audioMessage?.contextInfo
    ?? normalized?.stickerMessage?.contextInfo
    ?? normalized?.documentMessage?.contextInfo
    ?? normalized?.ptvMessage?.contextInfo
    ?? null;
}

function normalizeJid(value) {
  return String(value ?? '').trim().split(':')[0];
}

function identityTokens(value) {
  const jid = normalizeJid(value);
  if (!jid) return [];
  return [jid, jid.split('@')[0].replace(/\D/g, '')].filter(Boolean);
}

function isOwnMessage(context, quotedContext) {
  if (quotedContext?.fromMe === true) return true;

  const quotedIds = [
    quotedContext?.participant,
    quotedContext?.participantAlt,
  ].filter(Boolean).flatMap(identityTokens);
  if (!quotedIds.length) return false;

  const ownIds = [
    context.socket.user?.id,
    context.socket.user?.lid,
    context.socket.user?.pn,
    context.socket.user?.phoneNumber,
  ].filter(Boolean).flatMap(identityTokens);

  return quotedIds.some((id) => ownIds.includes(id));
}

function getQuotedStanzaId(message) {
  return getContextInfo(message)?.stanzaId ?? null;
}

function isPermissionError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  const status = Number(error?.output?.statusCode ?? error?.statusCode ?? error?.status);
  return status === 401 || status === 403
    || /not-authorized|not authorized|forbidden|not admin|admin required|not an admin/.test(message);
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
    if (ctx.isChannel) {
      const target = ctx.getNewsletterReplyTarget();
      if (!target?.messageId && !target?.serverId) {
        throw new Error('Reply pesan Channel yang ingin dihapus.');
      }

      await ctx.newsletter.revoke(ctx, target);
      await ctx.react('✅');
      return;
    }

    const quotedContext = getContextInfo(ctx.message);
    const stanzaId = quotedContext?.stanzaId;
    if (!stanzaId) throw new Error('Reply pesan yang ingin dihapus.');

    const fromMe = isOwnMessage(ctx, quotedContext);
    if (!ctx.isGroup && !fromMe) {
      throw new Error('Bot hanya bisa menghapus pesan yang dikirim bot sendiri di chat pribadi.');
    }

    if (ctx.isGroup && !fromMe) {
      const botRole = await ctx.capabilities.check(ctx.chatId);
      if (botRole.known && !botRole.isAdmin) {
        throw new Error('Bot harus menjadi admin grup untuk menghapus pesan anggota.');
      }
    }

    const participant = quotedContext?.participant ?? null;
    try {
      await ctx.socket.sendMessage(ctx.chatId, {
        delete: {
          remoteJid: ctx.chatId,
          id: stanzaId,
          ...(ctx.isGroup && participant ? { participant } : {}),
          fromMe,
        },
      });
      await ctx.react('✅');
    } catch (error) {
      if (ctx.isGroup && !fromMe && isPermissionError(error)) {
        throw new Error('Bot harus menjadi admin grup untuk menghapus pesan anggota.');
      }
      const where = ctx.isGroup ? 'grup' : 'chat';
      throw new Error(`Pesan tidak bisa dihapus di ${where}: ${error?.message ?? String(error)}`);
    }
  },
};
