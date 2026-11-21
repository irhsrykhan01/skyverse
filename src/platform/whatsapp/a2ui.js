import fs from 'node:fs';
import {
  generateWAMessageFromContent,
  proto,
} from '@whiskeysockets/baileys';
import { getMenuCategoryLabel, orderMenuCategories, resolveMenuCategory } from '../../core/menu-categories.js';

const SUPPORT_URL = 'https://saweria.co/irhsrykhan';

function button(name, params) {
  return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
    name,
    buttonParamsJson: JSON.stringify(params),
  });
}

async function sendInteractive(socket, jid, { body, footer, buttons, contextInfo = null }) {
  if (!socket?.user?.id) throw new Error('WhatsApp socket belum siap.');

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '',
      hasMediaAttachment: false,
    }),
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
      messageParamsJson: '{}',
      messageVersion: 1,
    }),
    ...(contextInfo ? { contextInfo } : {}),
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

function buildSupportPreview() {
  const bannerPath = new URL('../../../assets/link-preview/skylabs-banner.jpg.b64', import.meta.url);
  const encodedBanner = fs.readFileSync(bannerPath, 'utf8').replace(/\s+/g, '');
  const thumbnail = Buffer.from(encodedBanner, 'base64');
  if (!thumbnail.length) throw new Error('Banner SkyLabs untuk link preview menu kosong.');

  return {
    externalAdReply: {
      title: 'SKYVERSE • Virtual Assistant',
      body: 'Klik menu di bawah untuk mulai',
      mediaType: 1,
      renderLargerThumbnail: true,
      thumbnail,
      sourceUrl: SUPPORT_URL,
      showAdAttribution: false,
    },
  };
}

export async function sendA2UIMenu(socket, jid, { config, registry, body = null }) {
  const groups = registry.byCategory({ includeHidden: false });
  const ordered = orderMenuCategories(groups);

  const rows = ordered.map(([category, commands]) => ({
    header: getMenuCategoryLabel(category),
    title: `${getMenuCategoryLabel(category)} Menu`,
    description: `${commands.length} command${commands.length === 1 ? '' : 's'} tersedia`,
    id: `${config.prefix}categorymenu ${category}`,
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

  return sendInteractive(socket, jid, {
    body: body ?? `SkyVerse Online\nPrefix: ${config.prefix}\nCommands: ${registry.all({ includeHidden: false }).length}\n\nPilih kategori untuk melihat command yang tersedia.\n\nSupport SkyVerse:\n${SUPPORT_URL}`,
    footer: '© SKYVERSE • WhatsApp Assistant',
    buttons,
    contextInfo: buildSupportPreview(),
  });
}

export async function sendA2UICategoryMenu(socket, jid, { config, registry, category }) {
  const normalizedCategory = resolveMenuCategory(category);
  const groups = registry.byCategory({ includeHidden: false });
  const commands = normalizedCategory ? groups.get(normalizedCategory) ?? [] : [];
  if (!commands.length) throw new Error(`Kategori tidak ditemukan: ${category}`);

  const label = getMenuCategoryLabel(normalizedCategory);
  const rows = commands.slice(0, 10).map((item) => ({
    header: item.aliases?.[0] ? `${config.prefix}${item.aliases[0]}` : `${config.prefix}${item.name}`,
    title: `${config.prefix}${item.name}`,
    description: item.description,
    id: `${config.prefix}${item.name}`,
  }));

  return sendInteractive(socket, jid, {
    body: `SkyVerse • ${label}\n${commands.length} command tersedia.\n\nPilih command yang ingin dijalankan.`,
    footer: '© SKYVERSE • WhatsApp Assistant',
    buttons: [
      button('single_select', { title: `${label} Commands`, sections: [{ title: `${label} Menu`, rows }] }),
      button('quick_reply', { display_text: 'Kembali ke Menu', id: `${config.prefix}menu` }),
    ],
  });
}

export async function sendA2UITest(socket, jid) {
  return sendInteractive(socket, jid, {
    body: 'Interactive message test untuk SkyVerse. Coba tombol dan pilihan di bawah.',
    footer: '© SKYVERSE • WhatsApp Assistant',
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
