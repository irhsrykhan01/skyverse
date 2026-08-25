import { normalizeMessageContent } from '@whiskeysockets/baileys';

function getTextContent(message) {
  const content = normalizeMessageContent(message.message);
  if (!content) return '';

  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.documentMessage?.caption) return content.documentMessage.caption;
  if (content.documentWithCaptionMessage?.message?.documentMessage?.caption) {
    return content.documentWithCaptionMessage.message.documentMessage.caption;
  }
  return '';
}

export function parseIncomingMessage(message, prefix) {
  const configuredPrefix = String(prefix ?? '.');
  const text = getTextContent(message).trim();
  if (!text || !text.startsWith(configuredPrefix)) return null;

  const body = text.slice(configuredPrefix.length).trim();
  if (!body) return null;

  const [name = '', ...args] = body.split(/\s+/);
  if (!name) return null;

  return Object.freeze({
    raw: text,
    name: name.toLowerCase(),
    args,
    argumentText: args.join(' '),
  });
}

export function getMessageText(message) {
  return getTextContent(message).trim();
}
