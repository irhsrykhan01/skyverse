import fs from 'node:fs';
import { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { getMenuCategoryLabel, orderMenuCategories } from '../../core/menu-categories.js';

const SUPPORT_URL = 'https://saweria.co/irhsrykhan';
const SUPPORT_THUMBNAIL = new URL('../../../assets/link-preview/skylabs-banner.jpg.b64', import.meta.url);

function buildAllMenu(ctx) {
  const commands = ctx.registry.all({ includeHidden: false });
  const groups = new Map();

  for (const command of commands) {
    if (!groups.has(command.category)) groups.set(command.category, []);
    groups.get(command.category).push(command);
  }

  const userNumber = ctx.senderNumber
    ? `+${String(ctx.senderNumber).replace(/^\+/, '')}`
    : 'Tidak tersedia';
  const tier = ctx.isOwner
    ? 'Owner'
    : ctx.user?.is_premium
      ? 'Premium User'
      : 'Free User';

  const lines = [
    '╭───〔 *SKYVERSE BOT* 〕───',
    '│',
    `│ ◦ *User*          : ${userNumber}`,
    `│ ◦ *Tier*          : ${tier}`,
    `│ ◦ *Total Command* : ${commands.length} Commands`,
    '│',
    '╰────────────────────',
    '> All-in-one WhatsApp virtual bot assistant.',
    '\u034F'.repeat(1800),
  ];

  for (const [category, items] of orderMenuCategories(groups)) {
    lines.push('', `╭─「 *${getMenuCategoryLabel(category).toUpperCase()}* 」`);
    items.forEach((item, index) => {
      const branch = index === items.length - 1 ? '╰' : '├';
      lines.push(`${branch} ${ctx.config.prefix}${item.name}`);
    });
  }

  lines.push('', 'Support SkyVerse:', SUPPORT_URL);
  return lines.join('\n');
}

export const command = {
  name: 'allmenu',
  description: 'Menampilkan semua command aktif SkyVerse secara otomatis berdasarkan registry.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'allmenu',
  async execute(ctx) {
    const encodedThumbnail = fs.readFileSync(SUPPORT_THUMBNAIL, 'utf8').replace(/\s+/g, '');
    const thumbnail = Buffer.from(encodedThumbnail, 'base64');
    if (!thumbnail.length) throw new Error('Thumbnail link preview allmenu kosong.');

    let highQualityThumbnail;
    let jpegThumbnail = thumbnail;

    try {
      const prepared = await prepareWAMessageMedia(
        { image: thumbnail },
        {
          upload: ctx.socket.waUploadToServer,
          mediaTypeOverride: 'thumbnail-link',
        },
      );
      highQualityThumbnail = prepared?.imageMessage;
      if (highQualityThumbnail?.jpegThumbnail) {
        jpegThumbnail = Buffer.from(highQualityThumbnail.jpegThumbnail);
      }
    } catch (error) {
      console.warn('[SkyVerse] Link preview thumbnail upload failed:', error?.message ?? error);
    }

    const linkPreview = {
      'canonical-url': SUPPORT_URL,
      'matched-text': SUPPORT_URL,
      title: 'SkyLabs — SkyVerse',
      description: 'Dukung pengembangan SkyVerse dan kirim request fitur.',
      jpegThumbnail,
      ...(highQualityThumbnail ? { highQualityThumbnail } : {}),
    };

    const quote = ctx.isChannel || ctx.isBroadcast ? {} : { quoted: ctx.message };
    const sent = await ctx.socket.sendMessage(
      ctx.chatId,
      { text: buildAllMenu(ctx), linkPreview },
      quote,
    );

    if (!sent?.key?.id) {
      throw new Error('Baileys tidak mengembalikan message key untuk allmenu.');
    }
  },
};
