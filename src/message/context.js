import { normalizePhoneNumber } from '../security/identity.js';
import { getPermissionLevel } from '../security/permissions.js';
import { createGroupService, calculate, createNewsletterService } from '../services/index.js';
import { toMp3, toImage, toVideo, toSticker, toAnimatedSticker, toVoiceNote, toStickerWatermark } from '../services/media/index.js';
import { downloadResolvedMedia } from '../services/media/resolver.js';

function getSenderJid(message) {
  return message.key?.fromMe ? message.key?.participant ?? message.key?.remoteJid ?? null : message.key?.participant ?? message.key?.remoteJid ?? null;
}

function isGroupJid(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
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
    return downloadResolvedMedia({ socket, message, retries: 2, logger: console });
  }

  async function sendMedia(buffer, type, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Media hasil proses kosong atau tidak valid.');
    const payload = type === 'sticker'
      ? { sticker: buffer }
      : type === 'image'
        ? { image: buffer, mimetype: options.mimetype ?? 'image/jpeg', caption: options.caption }
        : type === 'video'
          ? { video: buffer, mimetype: options.mimetype ?? 'video/mp4', caption: options.caption, videoNote: Boolean(options.videoNote) }
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
