import { normalizeMessageContent, downloadContentFromMessage } from '@whiskeysockets/baileys';
import { extractMotionPhoto } from './media/motion-photo.js';

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
  const content = normalizeMessageContent(message?.message);
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.audioMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? content?.stickerMessage?.contextInfo
    ?? null;
}

function getQuotedMessage(message) {
  return getContextInfo(message)?.quotedMessage ?? null;
}

function getQuotedText(message) {
  const quoted = normalizeMessageContent(getQuotedMessage(message));
  return quoted?.conversation ?? quoted?.extendedTextMessage?.text ?? quoted?.imageMessage?.caption ?? quoted?.videoMessage?.caption ?? quoted?.documentMessage?.caption ?? '';
}

async function readMediaBuffer(mediaMessage, type) {
  const stream = await downloadContentFromMessage(mediaMessage, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function buildQuotedContent(context) {
  const quoted = normalizeMessageContent(getQuotedMessage(context.message));
  if (!quoted) return null;

  if (quoted.imageMessage) {
    const buffer = await readMediaBuffer(quoted.imageMessage, 'image');
    const motion = extractMotionPhoto(buffer);
    if (motion) {
      return {
        motionPhoto: true,
        image: motion.image,
        video: motion.video,
        caption: quoted.imageMessage.caption ?? '',
      };
    }
    return { image: buffer, ...(quoted.imageMessage.caption ? { caption: quoted.imageMessage.caption } : {}) };
  }
  if (quoted.videoMessage) return { video: await readMediaBuffer(quoted.videoMessage, 'video'), ...(quoted.videoMessage.caption ? { caption: quoted.videoMessage.caption } : {}) };
  if (quoted.audioMessage) return { audio: await readMediaBuffer(quoted.audioMessage, 'audio'), mimetype: quoted.audioMessage.mimetype ?? 'audio/mpeg', ptt: Boolean(quoted.audioMessage.ptt) };
  if (quoted.documentMessage) return { document: await readMediaBuffer(quoted.documentMessage, 'document'), mimetype: quoted.documentMessage.mimetype ?? 'application/octet-stream', fileName: quoted.documentMessage.fileName ?? 'file', ...(quoted.documentMessage.caption ? { caption: quoted.documentMessage.caption } : {}) };
  if (quoted.stickerMessage) return { sticker: await readMediaBuffer(quoted.stickerMessage, 'sticker') };
  if (quoted.conversation || quoted.extendedTextMessage?.text) return { text: getQuotedText(context.message) };
  return null;
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

    if (content.motionPhoto) {
      // WhatsApp/Baileys newsletter sending does not expose a stable native Motion Photo message type.
      // Keep the photo and motion video intact and use a safe two-message fallback.
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
  return Object.freeze({ getCurrentChannel, resolve, getSaved, setSaved, assertCanPost, upload });
}
