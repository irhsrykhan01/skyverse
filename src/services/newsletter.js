import { normalizeMessageContent } from '@whiskeysockets/baileys';
import { extractMotionPhoto } from './media/motion-photo.js';
import { downloadResolvedMedia, resolveMediaTarget } from './media/resolver.js';

const CHANNEL_SCOPE = 'user';
const CHANNEL_KEY = 'newsletter.channel';

function isNewsletterJid(value) {
  return typeof value === 'string' && value.endsWith('@newsletter');
}

function extractInviteCode(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/https?:\/\/whatsapp\.com\/channel\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function cleanJid(value) {
  if (!value) return null;
  const text = String(value).trim();
  return isNewsletterJid(text) ? text : null;
}

function normalizeMetadata(metadata) {
  if (!metadata?.id || !isNewsletterJid(metadata.id)) {
    throw new Error('Channel tidak valid atau JID newsletter tidak ditemukan.');
  }
  const thread = metadata.thread_metadata ?? {};
  return {
    id: metadata.id,
    name: metadata.name ?? thread.name?.text ?? 'Unknown Channel',
    description: metadata.description ?? thread.description?.text ?? '',
    invite: metadata.invite ?? thread.invite ?? '',
    subscribers: Number(metadata.subscribers ?? thread.subscribers_count ?? 0) || 0,
    verification: metadata.verification ?? thread.verification ?? 'UNVERIFIED',
    role: metadata.viewer_metadata?.role ?? null,
    updatedAt: Date.now(),
  };
}

async function requireNewsletterApi(socket) {
  if (typeof socket.newsletterMetadata !== 'function') {
    throw new Error('Versi Baileys saat ini tidak menyediakan newsletterMetadata.');
  }
}

async function resolveReference(socket, reference) {
  await requireNewsletterApi(socket);
  const value = String(reference ?? '').trim();
  if (!value) return null;
  const jid = cleanJid(value);
  if (jid) return normalizeMetadata(await socket.newsletterMetadata('jid', jid));
  const invite = extractInviteCode(value) ?? value;
  if (/^[A-Za-z0-9_-]{5,}$/.test(invite) && !invite.includes('@')) {
    return normalizeMetadata(await socket.newsletterMetadata('invite', invite));
  }
  throw new Error('Masukkan JID channel (@newsletter) atau link https://whatsapp.com/channel/.');
}

function getContextInfo(message) {
  const normalized = normalizeMessageContent(message?.message ?? message);
  return normalized?.extendedTextMessage?.contextInfo ??
    normalized?.imageMessage?.contextInfo ??
    normalized?.videoMessage?.contextInfo ??
    normalized?.ptvMessage?.contextInfo ??
    normalized?.audioMessage?.contextInfo ??
    normalized?.stickerMessage?.contextInfo ??
    normalized?.documentMessage?.contextInfo ??
    normalized?.viewOnceMessage?.message?.videoMessage?.contextInfo ??
    normalized?.viewOnceMessageV2?.message?.videoMessage?.contextInfo ??
    normalized?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ?? null;
}

function getQuotedMessage(message) {
  return getContextInfo(message)?.quotedMessage ?? null;
}

function getQuotedText(message) {
  const quoted = normalizeMessageContent(getQuotedMessage(message));
  return quoted?.conversation ?? quoted?.extendedTextMessage?.text ?? quoted?.imageMessage?.caption ?? quoted?.videoMessage?.caption ?? quoted?.ptvMessage?.caption ?? quoted?.documentMessage?.caption ?? '';
}

async function buildQuotedContent(context) {
  const descriptor = resolveMediaTarget(context.message);
  if (descriptor) {
    const downloaded = await downloadResolvedMedia({ socket: context.socket, message: context.message, retries: 2, logger: console });

    if (downloaded.type === 'video') {
      return {
        video: downloaded.buffer,
        ptv: Boolean(downloaded.isPTV),
        caption: downloaded.node?.caption ?? '',
      };
    }
    if (downloaded.type === 'image') {
      const motion = extractMotionPhoto(downloaded.buffer);
      if (motion) return { motionPhoto: true, image: motion.image, video: motion.video, caption: downloaded.node?.caption ?? '' };
      return { image: downloaded.buffer, caption: downloaded.node?.caption ?? '' };
    }
    if (downloaded.type === 'audio') return { audio: downloaded.buffer, mimetype: downloaded.mimetype, ptt: Boolean(downloaded.node?.ptt) };
    if (downloaded.type === 'document') return { document: downloaded.buffer, mimetype: downloaded.mimetype, fileName: downloaded.node?.fileName ?? 'file', caption: downloaded.node?.caption ?? '' };
    if (downloaded.type === 'sticker') return { sticker: downloaded.buffer };
  }

  const quoted = normalizeMessageContent(getQuotedMessage(context.message));
  if (quoted?.conversation || quoted?.extendedTextMessage?.text) return { text: getQuotedText(context.message) };
  return null;
}

function makeNewsletterMessageId(socket) {
  return typeof socket.generateMessageTag === 'function'
    ? socket.generateMessageTag()
    : `skyverse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function revokeNewsletterMessage(socket, jid, serverId, { ownMessage = false } = {}) {
  if (!isNewsletterJid(jid)) throw new Error('JID bukan Channel/newsletter.');
  if (serverId === undefined || serverId === null || String(serverId).trim() === '') {
    throw new Error('server_id pesan Channel tidak ditemukan.');
  }
  if (typeof socket.query !== 'function') {
    throw new Error('Baileys tidak menyediakan low-level query untuk revoke Channel pada versi ini.');
  }

  const messageId = makeNewsletterMessageId(socket);
  const edit = ownMessage ? '7' : '8';

  // Newsletter message revocation uses the newsletter message stanza rather
  // than the generic `{ delete: key }` chat protocol. The server identifies
  // the target by server_id and distinguishes sender/admin revoke with edit
  // attributes 7/8.
  await socket.query({
    tag: 'message',
    attrs: {
      to: jid,
      id: messageId,
      type: 'text',
      server_id: String(serverId),
      edit,
    },
  });

  return { messageId, serverId: String(serverId), edit };
}

export function createNewsletterService() {
  async function getCurrentChannel(context) {
    if (!isNewsletterJid(context.chatId)) throw new Error('Gunakan command ini di dalam Channel atau kirim link/JID channel.');
    return resolveReference(context.socket, context.chatId);
  }
  async function resolve(context, reference) { return resolveReference(context.socket, reference); }
  function getSaved(context) {
    const raw = context.repositories.settings.get(CHANNEL_SCOPE, context.senderJid, CHANNEL_KEY, null);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.id && isNewsletterJid(parsed.id) ? parsed : null;
    } catch { return null; }
  }
  async function setSaved(context, metadata) {
    context.repositories.settings.set(CHANNEL_SCOPE, context.senderJid, CHANNEL_KEY, JSON.stringify(metadata));
    return metadata;
  }
  async function assertCanPost(context, metadata) {
    const role = metadata?.role;
    if (role && !['ADMIN', 'OWNER'].includes(role)) throw new Error(`Akun ini bukan admin channel. Role: ${role}`);
  }

  async function upload(context, text = '') {
    const saved = getSaved(context);
    if (!saved) throw new Error(`Channel belum diatur. Gunakan ${context.config.prefix}setchannel <link/JID>.`);
    const latest = await resolveReference(context.socket, saved.id);
    await assertCanPost(context, latest);

    const quotedContent = await buildQuotedContent(context);
    const bodyText = String(text).trim();
    const content = quotedContent ?? (bodyText ? { text: bodyText } : null);
    if (!content) throw new Error(`Balas pesan yang ingin di-upload atau tulis teks setelah ${context.config.prefix}upch.`);

    if (content.video && !content.motionPhoto) {
      return context.socket.sendMessage(latest.id, {
        video: content.video,
        ...(content.caption ? { caption: content.caption } : {}),
        mimetype: 'video/mp4',
        ptv: Boolean(content.ptv),
      });
    }

    if (content.motionPhoto) {
      await context.socket.sendMessage(latest.id, {
        image: content.image,
        ...(content.caption ? { caption: content.caption } : {}),
      });
      return context.socket.sendMessage(latest.id, {
        video: content.video,
        caption: 'Motion Photo',
      });
    }

    return context.socket.sendMessage(latest.id, content);
  }

  async function revoke(context, target) {
    if (!context.isChannel) throw new Error('Revoke newsletter hanya bisa digunakan di Channel.');
    const saved = getSaved(context);
    if (!saved) throw new Error(`Channel belum diatur. Gunakan ${context.config.prefix}setchannel <link/JID>.`);
    const latest = await resolveReference(context.socket, saved.id);
    await assertCanPost(context, latest);
    return revokeNewsletterMessage(context.socket, latest.id, target.serverId, { ownMessage: Boolean(target.fromMe) });
  }

  return Object.freeze({ getCurrentChannel, resolve, getSaved, setSaved, assertCanPost, upload, revoke });
}
