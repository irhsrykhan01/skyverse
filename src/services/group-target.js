import { normalizeMessageContent } from '@whiskeysockets/baileys';

function unwrap(message) {
  let current = normalizeMessageContent(message?.message ?? message);
  if (current?.ephemeralMessage?.message) current = normalizeMessageContent(current.ephemeralMessage.message);
  if (current?.viewOnceMessage?.message) current = normalizeMessageContent(current.viewOnceMessage.message);
  if (current?.viewOnceMessageV2?.message) current = normalizeMessageContent(current.viewOnceMessageV2.message);
  return current;
}

export function getMentionedJid(message) {
  const content = unwrap(message);
  const context = content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? null;
  return context?.mentionedJid?.[0] ?? context?.participant ?? null;
}

export function getGroupTarget(message, args = []) {
  const mentioned = getMentionedJid(message);
  if (mentioned) return mentioned;
  const token = args.find((value) => /@|\d{7,}/.test(String(value)));
  if (!token) return null;
  const number = String(token).replace(/\D/g, '');
  return number ? `${number}@s.whatsapp.net` : null;
}
