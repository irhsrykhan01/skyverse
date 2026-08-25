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

function mediaDescriptor(message) {
  const content = unwrapMessage(message);
  if (!content) return null;
  if (content.imageMessage) return { type: 'image', node: content.imageMessage, mimetype: content.imageMessage.mimetype ?? 'image/jpeg', animated: false };
  if (content.videoMessage) return { type: 'video', node: content.videoMessage, mimetype: content.videoMessage.mimetype ?? 'video/mp4', animated: false };
  if (content.audioMessage) return { type: 'audio', node: content.audioMessage, mimetype: content.audioMessage.mimetype ?? 'audio/ogg; codecs=opus', animated: false };
  if (content.stickerMessage) return { type: 'sticker', node: content.stickerMessage, mimetype: content.stickerMessage.mimetype ?? 'image/webp', animated: Boolean(content.stickerMessage.isAnimated) };
  if (content.documentMessage) return { type: 'document', node: content.documentMessage, mimetype: content.documentMessage.mimetype ?? 'application/octet-stream', animated: false };
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

function bufferLooksPlausible(buffer, descriptor) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  const type = descriptor.type;
  const mimetype = String(descriptor.mimetype ?? '').toLowerCase();
  if (type === 'sticker' || mimetype.includes('webp')) return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype.includes('png')) return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'audio' && mimetype.includes('ogg')) return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  if (type === 'video' || mimetype.startsWith('video/')) return buffer.subarray(4, 8).toString('ascii') === 'ftyp' || buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  return true;
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
    const descriptor = mediaDescriptor(target);
    if (!descriptor) throw new Error('Tidak ada media yang bisa diproses. Reply gambar, video, audio, sticker, atau dokumen media.');

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const buffer = await downloadMediaMessage(
          target,
          'buffer',
          {},
          { logger: console, reuploadRequest: socket.updateMediaMessage },
        );
        if (!bufferLooksPlausible(buffer, descriptor)) throw new Error(`Data ${descriptor.type} hasil download tidak utuh atau formatnya tidak valid.`);
        return { buffer, type: descriptor.type, mimetype: descriptor.mimetype, animated: descriptor.animated, message: target };
      } catch (error) {
        lastError = error;
        if (attempt === 1) {
          try { await socket.updateMediaMessage(target); } catch { /* retry below */ }
        }
      }
    }

    throw new Error(`Gagal mengunduh media secara utuh: ${lastError?.message ?? 'downloadMediaMessage gagal.'}`);
  }

  async function sendMedia(buffer, type, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Media hasil proses kosong atau tidak valid.');
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
