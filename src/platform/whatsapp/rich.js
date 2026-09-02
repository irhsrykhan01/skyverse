import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

export function createRichMessage({ htmlPayload = '', text = '', trustedSources = [], actions = [] } = {}) {
  if (typeof htmlPayload !== 'string' || htmlPayload.length > 12000) {
    throw new Error('Rich htmlPayload tidak valid atau terlalu besar.');
  }

  return Object.freeze({
    htmlPayload,
    text: text || htmlToText(htmlPayload),
    trustedSources: [...new Set(trustedSources.filter((url) => /^https?:\/\//i.test(String(url))))],
    actions: actions.map((action) => Object.freeze({ ...action })),
  });
}

export function htmlToText(html) {
  return String(html)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nativeButton(name, params) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name,
    buttonParamsJson: JSON.stringify(params),
  });
}

export async function sendRichMessage(socket, jid, richMessage, { title = 'SkyVerse Rich', footer = 'SkyLabs • SkyVerse' } = {}) {
  if (!socket?.user?.id) throw new Error('WhatsApp socket belum siap.');

  const buttons = richMessage.actions
    .filter((action) => action?.id && action?.text)
    .slice(0, 10)
    .map((action) => nativeButton('quick_reply', {
      display_text: String(action.text).slice(0, 20),
      id: String(action.id),
    }));

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({
      text: richMessage.text || htmlToText(richMessage.htmlPayload),
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
      messageParamsJson: JSON.stringify({
        rich: {
          version: 1,
          renderer: 'skyverse',
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
