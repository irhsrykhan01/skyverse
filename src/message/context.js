import { normalizePhoneNumber } from '../security/identity.js';
import { getPermissionLevel } from '../security/permissions.js';
import { createGroupService, createCapabilityEngine, calculate, createNewsletterService } from '../services/index.js';
import { toMp3, toImage, toVideo, toSticker, toAnimatedSticker, toVoiceNote, toStickerWatermark } from '../services/media/index.js';
import { downloadResolvedMedia } from '../services/media/resolver.js';

function getSenderJid(message) {
  return message.key?.participant ?? message.key?.remoteJid ?? null;
}

function getSenderPhoneJid(message) {
  return message.key?.participantAlt ?? message.key?.remoteJidAlt ?? null;
}

function getChatType(jid) {
  if (typeof jid !== 'string') return 'unknown';
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@newsletter')) return 'channel';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid === 'status@broadcast') return 'status';
  return 'private';
}

function isGroupJid(jid) { return getChatType(jid) === 'group'; }
function canQuoteMessage(chatType) { return chatType !== 'channel' && chatType !== 'broadcast'; }

function getQuotedStanzaId(message) {
  const normalized = message?.message ?? message;
  const content = normalized?.extendedTextMessage ?? normalized?.imageMessage ?? normalized?.videoMessage
    ?? normalized?.ptvMessage ?? normalized?.audioMessage ?? normalized?.stickerMessage ?? normalized?.documentMessage;
  return content?.contextInfo?.stanzaId ?? null;
}

export function createMessageContext({ socket, message, command, registry, identity, config, parsed, providers, repositories, economy, resolveNewsletterMessage }) {
  const chatId = message.key?.remoteJid ?? '';
  const senderJid = getSenderJid(message);
  const senderPhoneJid = getSenderPhoneJid(message);
  const chatType = getChatType(chatId);
  const isGroup = isGroupJid(chatId);
  const isChannel = chatType === 'channel';
  const isBroadcast = chatType === 'broadcast';
  const isPrivate = chatType === 'private';
  const isOwner = identity.isOwner(senderPhoneJid || senderJid);
  const existingUser = repositories.users.get(senderJid);
  const userRecord = existingUser ?? economy?.ensureUser(senderJid, { pushName: message.pushName ?? null });
  // Baileys uses participantAlt/remoteJidAlt for the PN when the primary JID is a LID.
  // Persist the PN as the human-facing phone number while keeping the LID as the stable DB key.
  if (userRecord && senderPhoneJid) {
    repositories.users.upsert({
      jid: senderJid,
      phoneJid: senderPhoneJid,
      pushName: message.pushName ?? userRecord.push_name ?? null,
      isBot: Boolean(userRecord.is_bot),
    });
  }
  const refreshedUser = repositories.users.get(senderJid) ?? userRecord;
  const userNumber = refreshedUser?.number ?? normalizePhoneNumber(String(senderPhoneJid || senderJid).split('@')[0]);
  let groupMetadataPromise = null;
  const capabilities = createCapabilityEngine(socket);
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
    const participant = metadata.participants?.find((item) => [item.id, item.pn, item.lid].filter(Boolean).some((id) => id === senderJid || id === senderPhoneJid));
    return Boolean(participant?.admin);
  }

  async function permissionLevel(required = 'user') {
    if (isOwner) return getPermissionLevel({ isOwner: true });
    if (required !== 'admin') return getPermissionLevel();
    return getPermissionLevel({ isGroupAdmin: await isAdmin() });
  }

  async function reply(text, options = {}) {
    const sendOptions = options.sendOptions ?? {};
    const quote = options.quoted === false || !canQuoteMessage(chatType) ? {} : { quoted: message };
    return socket.sendMessage(chatId, { text: String(text) }, { ...quote, ...sendOptions });
  }
  async function react(emoji = '👍') { return socket.sendMessage(chatId, { react: { text: emoji, key: message.key } }); }
  async function read() { if (message.key?.id) return socket.readMessages([message.key]); }
  async function sendPresence(type) { return socket.sendPresenceUpdate(type, chatId); }
  async function downloadMedia() { return downloadResolvedMedia({ socket, message, retries: 2, logger: console }); }
  async function sendMedia(buffer, type, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Media hasil proses kosong atau tidak valid.');
    const payload = type === 'sticker' ? { sticker: buffer }
      : type === 'image' ? { image: buffer, mimetype: options.mimetype ?? 'image/jpeg', caption: options.caption }
      : type === 'video' ? { video: buffer, mimetype: options.mimetype ?? 'video/mp4', caption: options.caption, ptv: Boolean(options.ptv) }
      : type === 'audio' ? { audio: buffer, mimetype: options.mimetype ?? 'audio/mpeg', ptt: Boolean(options.ptt) }
      : { document: buffer, mimetype: options.mimetype ?? 'application/octet-stream', fileName: options.fileName ?? 'SkyVerse.bin' };
    const quote = options.quoted === false || !canQuoteMessage(chatType) ? {} : { quoted: message };
    return socket.sendMessage(chatId, payload, quote);
  }
  function getNewsletterReplyTarget() {
    if (!isChannel) return null;
    const stanzaId = getQuotedStanzaId(message);
    if (!stanzaId) return null;
    const cached = typeof resolveNewsletterMessage === 'function' ? resolveNewsletterMessage(chatId, stanzaId) : null;
    return cached ?? { messageId: stanzaId, serverId: null, fromMe: false };
  }

  return Object.freeze({
    socket, message, config, registry, command, parsed, providers, repositories, economy,
    chatId, chatType, senderJid, senderPhoneJid, senderNumber: userNumber,
    user: refreshedUser, isGroup, isChannel, isBroadcast, isPrivate, isOwner,
    capabilities, getGroupMetadata, isAdmin, permissionLevel, reply, react, read, sendPresence,
    getNewsletterReplyTarget, group, newsletter, calculate,
    media: Object.freeze({ toMp3, toImage, toVideo, toSticker, toAnimatedSticker, toVoiceNote, toStickerWatermark, download: downloadMedia, send: sendMedia }),
  });
}
