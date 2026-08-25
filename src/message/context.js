import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { normalizePhoneNumber } from '../security/identity.js';
import { getPermissionLevel } from '../security/permissions.js';
import { createGroupService, calculate, createNewsletterService } from '../services/index.js';
import { toMp3, toImage, toVideo, toSticker, toAnimatedSticker, toVoiceNote, toStickerWatermark } from '../services/media/index.js';

function getSenderJid(message) {
  return message.key?.fromMe ? message.key?.participant ?? message.key?.remoteJid ?? null : message.key?.participant ?? message.key?.remoteJid ?? null;
}

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function unwrapMessage(message) {
  let current = message?.message ?? message;
  if (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message;
  if (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message;
  if (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
  if (current?.documentWithCaptionMessage?.message) current = current.documentWithCaptionMessage.message;
  return current ?? null;
}

function mediaTypeOf(message) {
  const content = unwrapMessage(message);
  if (!content) return null;
  if (content.imageMessage) return 'image';
  if (content.videoMessage) return 'video';
  if (content.audioMessage) return 'audio';
  if (content.stickerMessage) return 'sticker';
  if (content.documentMessage) return 'document';
  return null;
}

function quotedWAMessage(message) {
  const content = unwrapMessage(message);
  const contextInfo = content?.extendedTextMessage?.contextInfo ??
    content?.imageMessage?.contextInfo ??
    content?.videoMessage?.contextInfo ??
    content?.documentMessage?.contextInfo ??
    content?.audioMessage?.contextInfo ??
    content?.stickerMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return null;
  return {
    key: {
      remoteJid: message.key?.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
      fromMe: false,
    },
    message: quoted,
  };
}

function targetMediaMessage(message) {
  return quotedWAMessage(message) ?? message;
}

export function createMessageContext({ socket, message, command, registry, identity, config, parsed, providers, repositories }) {
  const chatId = message.key?.remoteJid ?? '';
  const senderJid = getSenderJid(message);
  const isGroup = isGroupJid(chatId);
  const isOwner = identity.isOwner(senderJid);
  let groupMetadataPromise = null;
  const group = createGroupService();
  const newsletter = createNewsletterService();

  async function getGroupMetadata() {
    if (!isGroup) return null;
    groupMetadataPromise ??= socket.groupMetadata(chatId);
    return groupMetadataPromise;
  }

  async function isAdmin() {
    if (!isGroup || !senderJid) return false;
    const metadata = await getGroupMetadata();
    const participant = metadata.participants?.find((item) => [item.id, item.pn, item.lid].filter(Boolean).includes(senderJid));
    return Boolean(participant?.admin);
  }

  async function permissionLevel(required = 'user') {
    if (isOwner) return getPermissionLevel({ isOwner: true });
    if (required !== 'admin') return getPermissionLevel();
    return getPermissionLevel({ isGroupAdmin: await isAdmin() });
  }

  async function reply(text, options = {}) {
    return socket.sendMessage(chatId, { text: String(text) }, { quoted: options.quoted === false ? undefined : message, ...options.sendOptions });
  }

  async function react(emoji = '👍') {
    return socket.sendMessage(chatId, { react: { text: emoji, key: message.key } });
  }

  async function read() {
    if (!message.key?.id) return;
    return socket.readMessages([message.key]);
  }

  async function sendPresence(type) {
    return socket.sendPresenceUpdate(type, chatId);
  }

  async function downloadMedia() {
    const target = targetMediaMessage(message);
    const type = mediaTypeOf(target);
    if (!type) throw new Error('Tidak ada media yang bisa diproses. Kirim atau reply gambar, video, audio, atau sticker.');
    const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: undefined, reuploadRequest: socket.updateMediaMessage });
    return { buffer, type, message: target };
  }

  async function sendMedia(buffer, type, options = {}) {
    const payload = type === 'sticker'
      ? { sticker: buffer }
      : type === 'image'
        ? { image: buffer, mimetype: options.mimetype ?? 'image/jpeg', caption: options.caption }
        : type === 'video'
          ? { video: buffer, mimetype: options.mimetype ?? 'video/mp4', caption: options.caption }
          : type === 'audio'
            ? { audio: buffer, mimetype: options.mimetype ?? 'audio/mpeg', ptt: Boolean(options.ptt) }
            : { document: buffer, mimetype: options.mimetype ?? 'application/octet-stream', fileName: options.fileName ?? 'SkyVerse.bin' };
    return socket.sendMessage(chatId, payload, { quoted: options.quoted === false ? undefined : message });
  }

  return Object.freeze({
    socket, message, config, registry, command, parsed, providers, repositories,
    chatId, senderJid, senderNumber: normalizePhoneNumber(senderJid?.split('@')[0]),
    isGroup, isOwner, getGroupMetadata, isAdmin, permissionLevel, reply, react, read, sendPresence,
    group, newsletter, calculate,
    media: Object.freeze({
      toMp3, toImage, toVideo, toSticker, toAnimatedSticker, toVoiceNote, toStickerWatermark,
      download: downloadMedia, send: sendMedia,
    }),
  });
}
