import fs from 'node:fs';
import {
  generateWAMessageFromContent,
  isJidGroup,
  prepareWAMessageMedia,
  proto,
} from '@whiskeysockets/baileys';
import { getMenuCategoryLabel, orderMenuCategories, resolveMenuCategory } from '../../core/menu-categories.js';

const SUPPORT_URL = 'https://saweria.co/irhsrykhan';

function buildBizNode() {
  const privacyModeTs = (Math.floor(Date.now() / 1000) - 77980457).toString();
  return {
    tag: 'biz',
    attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: privacyModeTs },
    content: [
      { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
      { tag: 'quality_control', attrs: { source_type: 'third_party' } },
    ],
  };
}

function button(name, params) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name,
    buttonParamsJson: JSON.stringify(params),
  });
}

async function sendInteractive(socket, jid, { title, body, footer, buttons, imageMessage = null }) {
  if (!socket?.user?.id) throw new Error('WhatsApp socket belum siap.');

  const header = proto.Message.InteractiveMessage.Header.create({
    title,
    subtitle: 'SkyLabs • SkyVerse',
    hasMediaAttachment: Boolean(imageMessage),
    ...(imageMessage ? { imageMessage } : {}),
  });

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header,
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
      messageParamsJson: '{}',
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

  const bizNode = buildBizNode();
  const additionalNodes = isJidGroup(jid)
    ? [bizNode]
    : [{ tag: 'bot', attrs: { biz_bot: '1' } }, bizNode];

  await socket.relayMessage(jid, waMessage.message, {
    messageId: waMessage.key.id,
    additionalNodes,
  });
  return waMessage.key;
}

function readMenuBanner() {
  const bannerPath = new URL('../../../assets/link-preview/skylabs-banner.jpg.b64', import.meta.url);
  const encodedBanner = fs.readFileSync(bannerPath, 'utf8').replace(/\s+/g, '');
  const banner = Buffer.from(encodedBanner, 'base64');

  if (!banner.length) {
    throw new Error('Banner SkyLabs kosong atau gagal dibaca.');
  }

  return banner;
}

async function prepareMenuBanner(socket) {
  if (typeof socket.waUploadToServer !== 'function') {
    throw new Error('Uploader media WhatsApp belum siap untuk banner menu.');
  }

  const prepared = await prepareWAMessageMedia(
    { image: readMenuBanner() },
    { upload: socket.waUploadToServer },
  );

  if (!prepared?.imageMessage) {
    throw new Error('Gagal menyiapkan banner SkyLabs sebagai media pesan.');
  }

  return prepared.imageMessage;
}

export async function sendA2UIMenu(socket, jid, { config, registry, body = null }) {
  const groups = registry.byCategory({ includeHidden: false });
  const ordered = orderMenuCategories(groups);

  const rows = ordered.map(([category, commands]) => ({
    header: getMenuCategoryLabel(category),
    title: getMenuCategoryLabel(category) + ' Menu',
    description: commands.length + ' command' + (commands.length === 1 ? '' : 's') + ' tersedia',
    id: config.prefix + 'categorymenu ' + category,
  }));

  const buttons = [
    button('single_select', {
      title: 'Pilih Kategori',
      sections: [{ title: 'SkyVerse Menu', rows: rows.slice(0, 10) }],
    }),
    button('cta_url', {
      display_text: 'Support SkyVerse',
      url: SUPPORT_URL,
      merchant_url: SUPPORT_URL,
    }),
  ];

  const imageMessage = await prepareMenuBanner(socket);

  return sendInteractive(socket, jid, {
    title: config.botName || 'SKYVERSE BOT',
    body: body ?? ('SkyVerse Online\nPrefix: ' + config.prefix + '\nCommands: ' + registry.all({ includeHidden: false }).length + '\n\nPilih kategori untuk melihat command yang tersedia.'),
    footer: 'SkyLabs • SkyVerse',
    buttons,
    imageMessage,
  });
}

export async function sendA2UICategoryMenu(socket, jid, { config, registry, category }) {
  const normalizedCategory = resolveMenuCategory(category);
  const groups = registry.byCategory({ includeHidden: false });
  const commands = normalizedCategory ? groups.get(normalizedCategory) ?? [] : [];
  if (!commands.length) throw new Error('Kategori tidak ditemukan: ' + category);

  const label = getMenuCategoryLabel(normalizedCategory);
  const rows = commands.slice(0, 10).map((item) => ({
    header: item.aliases?.[0] ? config.prefix + item.aliases[0] : config.prefix + item.name,
    title: config.prefix + item.name,
    description: item.description,
    id: config.prefix + item.name,
  }));

  return sendInteractive(socket, jid, {
    title: label + ' Menu',
    body: 'SkyVerse • ' + label + '\n' + commands.length + ' command tersedia.\n\nPilih command yang ingin dijalankan.',
    footer: 'SkyLabs • SkyVerse',
    buttons: [
      button('single_select', { title: label + ' Commands', sections: [{ title: label + ' Menu', rows }] }),
      button('quick_reply', { display_text: 'Kembali ke Menu', id: config.prefix + 'menu' }),
    ],
  });
}

export async function sendA2UITest(socket, jid) {
  return sendInteractive(socket, jid, {
    title: 'SkyVerse A2UI Test',
    body: 'Interactive message test untuk SkyVerse. Coba tombol dan pilihan di bawah.',
    footer: 'SkyLabs • SkyVerse',
    buttons: [
      button('quick_reply', { display_text: 'Tes Quick Reply', id: 'skyverse_a2ui_quick_reply' }),
      button('single_select', {
        title: 'Pilih Fitur',
        sections: [{ title: 'SkyVerse A2UI', rows: [
          { header: 'General Menu', title: 'Menu SkyVerse', description: 'Buka menu utama SkyVerse', id: '.menu' },
          { header: 'System', title: 'Bot Info', description: 'Lihat informasi bot', id: '.info' },
        ] }],
      }),
      button('cta_url', { display_text: 'Support SkyVerse', url: SUPPORT_URL, merchant_url: SUPPORT_URL }),
    ],
  });
}
