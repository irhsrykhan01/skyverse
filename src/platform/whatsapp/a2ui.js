import fs from 'node:fs';
import {
  generateWAMessageFromContent,
  isJidGroup,
  prepareWAMessageMedia,
  proto,
} from '@whiskeysockets/baileys';

const THUMBNAIL_BASE64 = fs.readFileSync(
  new URL('../../../assets/skylabs-a2ui.jpg.b64', import.meta.url),
  'utf8',
).trim();

function buildBizNode() {
  const privacyModeTs = (Math.floor(Date.now() / 1000) - 77980457).toString();

  return {
    tag: 'biz',
    attrs: {
      actual_actors: '2',
      host_storage: '2',
      privacy_mode_ts: privacyModeTs,
    },
    content: [
      {
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [
          {
            tag: 'native_flow',
            attrs: { v: '9', name: 'mixed' },
          },
        ],
      },
      {
        tag: 'quality_control',
        attrs: { source_type: 'third_party' },
      },
    ],
  };
}

function button(name, params) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name,
    buttonParamsJson: JSON.stringify(params),
  });
}

export async function sendA2UITest(socket, jid) {
  if (!socket?.user?.id) throw new Error('WhatsApp socket belum siap.');

  const imageBuffer = Buffer.from(THUMBNAIL_BASE64, 'base64');
  const imageMessage = await prepareWAMessageMedia(
    { image: imageBuffer },
    { upload: socket.waUploadToServer },
  );

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: 'SkyVerse A2UI Test',
      subtitle: 'Native Flow Interactive Message',
      hasMediaAttachment: true,
      ...imageMessage,
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: 'Interactive message test untuk SkyVerse. Coba tombol dan pilihan di bawah.',
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({
      text: 'SkyLabs • SkyVerse',
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [
        button('quick_reply', {
          display_text: 'Tes Quick Reply',
          id: 'skyverse_a2ui_quick_reply',
        }),
        button('single_select', {
          title: 'Pilih Fitur',
          sections: [
            {
              title: 'SkyVerse A2UI',
              rows: [
                {
                  header: 'General',
                  title: 'Menu SkyVerse',
                  description: 'Buka menu utama SkyVerse',
                  id: '.menu',
                },
                {
                  header: 'System',
                  title: 'Bot Info',
                  description: 'Lihat informasi bot',
                  id: '.info',
                },
              ],
            },
          ],
        }),
        button('cta_url', {
          display_text: 'Support SkyVerse',
          url: 'https://saweria.co/irhsrykhn',
          merchant_url: 'https://saweria.co/irhsrykhn',
        }),
      ],
      messageParamsJson: '{}',
      messageVersion: 1,
    }),
  });

  const waMessage = generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage,
        },
      },
    },
    { userJid: socket.user.id },
  );

  const bizNode = buildBizNode();
  const botNode = { tag: 'bot', attrs: { biz_bot: '1' } };
  const additionalNodes = isJidGroup(jid) ? [bizNode] : [botNode, bizNode];

  await socket.relayMessage(jid, waMessage.message, {
    messageId: waMessage.key.id,
    additionalNodes,
  });

  return waMessage.key;
}
