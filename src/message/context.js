import { normalizePhoneNumber } from '../security/identity.js';
import { getPermissionLevel } from '../security/permissions.js';
import { createGroupService, calculate, createNewsletterService } from '../services/index.js';
import { toMp3, toImage, toVideo, toSticker, toAnimatedSticker } from '../services/media/index.js';

function getSenderJid(message) {
  if (message.key?.fromMe) return message.key?.participant ?? message.key?.remoteJid ?? null;
  return message.key?.participant ?? message.key?.remoteJid ?? null;
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
    const participant = metadata.participants?.find((item) => {
      const ids = [item.id, item.pn, item.lid].filter(Boolean);
      return ids.includes(senderJid);
    });
    return Boolean(participant?.admin);
  }

  async function permissionLevel(required = 'user') {
    if (isOwner) return getPermissionLevel({ isOwner: true });
    if (required !== 'admin') return getPermissionLevel();
    return getPermissionLevel({ isGroupAdmin: await isAdmin() });
  }

  async function reply(text, options = {}) {
    return socket.sendMessage(chatId, { text: String(text) }, {
      quoted: options.quoted === false ? undefined : message,
      ...options.sendOptions,
    });
  }

  async function react(emoji = '👍') {
    return socket.sendMessage(chatId, {
      react: { text: emoji, key: message.key },
    });
  }

  async function read() {
    if (!message.key?.id) return;
    return socket.readMessages([message.key]);
  }

  async function sendPresence(type) {
    return socket.sendPresenceUpdate(type, chatId);
  }

  return Object.freeze({
    socket,
    message,
    config,
    registry,
    command,
    parsed,
    providers,
    repositories,
    chatId,
    senderJid,
    senderNumber: normalizePhoneNumber(senderJid?.split('@')[0]),
    isGroup,
    isOwner,
    getGroupMetadata,
    isAdmin,
    permissionLevel,
    reply,
    react,
    read,
    sendPresence,
    group,
    newsletter,
    calculate,
    media: Object.freeze({ toMp3, toImage, toVideo, toSticker, toAnimatedSticker }),
  });
}
