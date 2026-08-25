import { downloadMediaMessage, normalizeMessageContent } from '@whiskeysockets/baileys';

function unwrapMessage(message) {
  return normalizeMessageContent(message?.message ?? message) ?? null;
}

function getContextInfo(message) {
  const content = unwrapMessage(message);
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.stickerMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? null;
}

function getMediaDescriptor(message) {
  const content = unwrapMessage(message);
  if (!content) return null;
  if (content.stickerMessage) return { type: 'sticker', mimetype: content.stickerMessage.mimetype ?? 'image/webp' };
  if (content.videoMessage) return { type: 'video', mimetype: content.videoMessage.mimetype ?? 'video/mp4' };
  if (content.documentMessage && /^(image|video)\//i.test(content.documentMessage.mimetype ?? '')) {
    return { type: 'document', mimetype: content.documentMessage.mimetype };
  }
  return null;
}

function quotedMessageTarget(message) {
  const contextInfo = getContextInfo(message);
  if (!contextInfo?.quotedMessage) return null;
  return {
    key: {
      remoteJid: message.key?.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
      fromMe: false,
    },
    message: contextInfo.quotedMessage,
  };
}

export const command = {
  name: 'toimg',
  description: 'Mengubah sticker atau video menjadi gambar JPEG dari frame pertama.',
  category: 'sticker',
  aliases: ['toimage'],
  usage: 'toimg (reply sticker atau video)',
  permission: 'user',
  minArgs: 0,
  maxArgs: 0,
  cooldown: 3000,
  async execute(ctx) {
    const target = quotedMessageTarget(ctx.message) ?? ctx.message;
    const descriptor = getMediaDescriptor(target);
    if (!descriptor) throw new Error('Reply sticker atau video yang ingin diubah menjadi gambar.');

    let mediaBuffer;
    try {
      mediaBuffer = await downloadMediaMessage(
        target,
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: ctx.socket.updateMediaMessage,
        },
      );
    } catch (error) {
      throw new Error(`Gagal mengunduh media: ${error?.message ?? String(error)}`);
    }

    if (!Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
      throw new Error('Gagal mengunduh media. Buffer kosong.');
    }

    const output = await ctx.media.toImage(mediaBuffer);
    if (!Buffer.isBuffer(output) || output.length < 1024) {
      throw new Error('Hasil gambar kosong atau terlalu kecil.');
    }

    await ctx.media.send(output, 'image', { mimetype: 'image/jpeg' });
  },
};
