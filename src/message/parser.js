import { normalizeMessageContent } from '@whiskeysockets/baileys';

function getInteractiveResponseId(content) {
  const response = content?.interactiveResponseMessage;
  if (!response) return '';

  let params = {};
  try {
    params = JSON.parse(response?.nativeFlowResponseMessage?.paramsJson || '{}');
  } catch {
    params = {};
  }

  return String(
    params.id
      ?? params.single_select_reply?.selected_row_id
      ?? params.native_flow_response?.id
      ?? response?.body?.text
      ?? '',
  ).trim();
}

function getTextContent(message) {
  const content = normalizeMessageContent(message.message);
  if (!content) return '';

  const interactiveId = getInteractiveResponseId(content);
  if (interactiveId) return interactiveId;

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
  if (!text) return null;

  const categoryMatch = text.match(/^!(.+?)\s+Menu!$/i);
  if (categoryMatch) {
    const category = categoryMatch[1].trim().toLowerCase();
    return Object.freeze({
      raw: text,
      name: 'categorymenu',
      args: [category],
      argumentText: category,
    });
  }

  if (!text.startsWith(configuredPrefix)) return null;

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
