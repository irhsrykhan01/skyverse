import { downloadMediaMessage, getContentType, normalizeMessageContent } from '@whiskeysockets/baileys';

function unwrapContextInfo(content) {
  return content?.extendedTextMessage?.contextInfo ??
    content?.imageMessage?.contextInfo ??
    content?.videoMessage?.contextInfo ??
    content?.audioMessage?.contextInfo ??
    content?.stickerMessage?.contextInfo ??
    content?.documentMessage?.contextInfo ?? null;
}

function getQuotedMessage(message) {
  const normalized = normalizeMessageContent(message?.message ?? message);
  const contextInfo = unwrapContextInfo(normalized);
  if (!contextInfo?.quotedMessage) return null;

  const normalizedQuoted = normalizeMessageContent(contextInfo.quotedMessage) ?? contextInfo.quotedMessage;
  return {
    key: {
      remoteJid: message.key?.remoteJid,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant,
      fromMe: false,
    },
    message: normalizedQuoted,
  };
}

function normalizedMessage(message) {
  const content = normalizeMessageContent(message?.message ?? message);
  if (!content) return null;
  return { ...message, message: content };
}

function describeMedia(message) {
  const normalized = normalizedMessage(message);
  const type = getContentType(normalized?.message);
  if (!normalized || !type) return null;

  const node = normalized.message[type];
  if (!node || typeof node !== 'object') return null;

  if (type === 'imageMessage') return { message: normalized, type: 'image', node, mimetype: node.mimetype ?? 'image/jpeg', animated: false };
  if (type === 'videoMessage') return { message: normalized, type: 'video', node, mimetype: node.mimetype ?? 'video/mp4', animated: false };
  if (type === 'audioMessage') return { message: normalized, type: 'audio', node, mimetype: node.mimetype ?? 'audio/ogg; codecs=opus', animated: false };
  if (type === 'stickerMessage') return { message: normalized, type: 'sticker', node, mimetype: node.mimetype ?? 'image/webp', animated: Boolean(node.isAnimated) };
  if (type === 'documentMessage') return { message: normalized, type: 'document', node, mimetype: node.mimetype ?? 'application/octet-stream', animated: false };
  return null;
}

function plausibleSignature(buffer, descriptor) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  const mime = String(descriptor.mimetype ?? '').toLowerCase();
  if (descriptor.type === 'sticker' || mime.includes('webp')) return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mime.includes('jpeg') || mime.includes('jpg')) return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime.includes('png')) return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime.includes('ogg')) return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  if (mime.includes('mp3') || mime.includes('mpeg')) return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (descriptor.type === 'video' || mime.startsWith('video/')) return buffer.subarray(4, 8).toString('ascii') === 'ftyp' || buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  return true;
}

export function resolveMediaTarget(message) {
  const quoted = getQuotedMessage(message);
  return describeMedia(quoted ?? message);
}

export async function downloadResolvedMedia({ socket, message, retries = 2, logger = console }) {
  let target = getQuotedMessage(message) ?? message;
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const descriptor = describeMedia(target);
    if (!descriptor) throw new Error('Tidak ada media yang bisa diproses. Reply atau kirim gambar, video, audio, sticker, atau dokumen media.');

    try {
      const buffer = await downloadMediaMessage(
        descriptor.message,
        'buffer',
        {},
        {
          logger,
          reuploadRequest: async (requestMessage) => socket.updateMediaMessage(requestMessage ?? descriptor.message),
        },
      );

      if (!plausibleSignature(buffer, descriptor)) throw new Error(`Media ${descriptor.type} hasil download tidak valid atau belum lengkap.`);
      return { ...descriptor, buffer };
    } catch (error) {
      lastError = error;
      if (attempt > retries) break;
      try {
        const refreshed = await socket.updateMediaMessage(descriptor.message);
        if (refreshed?.message) target = refreshed;
      } catch (refreshError) {
        logger?.warn?.({ error: refreshError?.message }, 'Media reupload refresh failed; retrying standard downloader');
      }
    }
  }

  throw new Error(`Gagal mengunduh media setelah beberapa percobaan: ${lastError?.message ?? 'unknown error'}`);
}
