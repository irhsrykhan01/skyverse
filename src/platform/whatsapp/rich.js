import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

const MAX_HTML_PAYLOAD = 12000;
const ALLOWED_HTML = /^(?:h1|h2|h3|p|div|span|b|strong|i|em|br|ul|ol|li|code|pre|a)$/i;

function stripUnsafeHtml(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<([a-z0-9]+)([^>]*)>/gi, (full, tag, attrs) => {
      if (!ALLOWED_HTML.test(tag)) return '';
      if (tag.toLowerCase() !== 'a') return `<${tag}>`;
      const href = String(attrs).match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      return href && /^https?:\/\//i.test(href) ? `<a href="${href}">` : '<a>';
    });
}

export function createRichMessage({ htmlPayload = '', text = '', trustedSources = [], actions = [] } = {}) {
  if (typeof htmlPayload !== 'string' || htmlPayload.length > MAX_HTML_PAYLOAD) {
    throw new Error('Rich htmlPayload tidak valid atau terlalu besar.');
  }

  const safeHtml = stripUnsafeHtml(htmlPayload);

  return Object.freeze({
    htmlPayload: safeHtml,
    text: text || htmlToText(safeHtml),
    trustedSources: [...new Set(trustedSources.filter((url) => /^https?:\/\//i.test(String(url))))],
    actions: actions.map((action) => Object.freeze({ ...action })),
  });
}

export function htmlToText(html) {
  return String(html)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|pre)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlTitle(html) {
  const match = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? htmlToText(match[1]).slice(0, 80) : '';
}

function nativeButton(name, params) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name,
    buttonParamsJson: JSON.stringify(params),
  });
}

export async function sendRichMessage(socket, jid, richMessage, { title = '', footer = 'SkyLabs • SkyVerse' } = {}) {
  if (!socket?.user?.id) throw new Error('WhatsApp socket belum siap.');

  const buttons = richMessage.actions
    .filter((action) => action?.id && action?.text)
    .slice(0, 10)
    .map((action) => nativeButton('quick_reply', {
      display_text: String(action.text).slice(0, 20),
      id: String(action.id),
    }));

  const renderedTitle = title || htmlTitle(richMessage.htmlPayload);
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: renderedTitle
      ? proto.Message.InteractiveMessage.Header.create({ title: renderedTitle, hasMediaAttachment: false })
      : undefined,
    body: proto.Message.InteractiveMessage.Body.create({
      text: richMessage.text || htmlToText(richMessage.htmlPayload),
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
      messageParamsJson: JSON.stringify({
        skyverseRich: {
          version: 1,
          renderer: 'skyverse-html',
          htmlPayload: richMessage.htmlPayload,
          trustedSources: richMessage.trustedSources,
        },
      }),
      messageVersion: 1,
    }),
  });

  const waMessage = generateWAMessageFromContent(jid, {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage,
      },
    },
  }, { userJid: socket.user.id });

  await socket.relayMessage(jid, waMessage.message, {
    messageId: waMessage.key.id,
  });

  return waMessage.key;
}
