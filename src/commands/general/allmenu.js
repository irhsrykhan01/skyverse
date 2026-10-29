import fs from 'node:fs';
import { getMenuCategoryLabel, orderMenuCategories } from '../../core/menu-categories.js';

const SUPPORT_URL = 'https://saweria.co/irhsrykhn';
const BANNER_PATH = new URL('../../../assets/SkyLabs_banner.jpg', import.meta.url);

function buildAllMenu(ctx) {
  const groups = ctx.registry.byCategory({ includeHidden: false });
  const ordered = orderMenuCategories(groups);
  const commands = ctx.registry.all({ includeHidden: false });
  const total = commands.length;
  const tag = ctx.senderJid?.split('@')[0] ?? 'User';
  const tier = ctx.user?.is_premium ? 'Premium User' : 'Free User';

  const lines = [
    '❖  *SKYVERSE*  ❖',
    '───────────────',
    `Halo, @${tag}`,
    `⋄ Status : ${tier}`,
    `⋄ Total  : ${total} Commands`,
    '───────────────',
    '> _All-in-one WhatsApp virtual bot assistant._',
  ];

  for (const [category, items] of ordered) {
    lines.push('', `⚝ *${getMenuCategoryLabel(category).toUpperCase()}*`);
    for (const item of items) {
      lines.push(`⊛ ${ctx.config.prefix}${item.name}`);
    }
  }

  lines.push('', '───────────────', '💡 Dukung SkyVerse:', SUPPORT_URL);
  return lines.join('\n');
}

export const command = {
  name: 'allmenu',
  description: 'Menampilkan semua command SkyVerse secara otomatis berdasarkan registry.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'allmenu',
  async execute(ctx) {
    const thumbnail = fs.readFileSync(BANNER_PATH);
    if (!Buffer.isBuffer(thumbnail) || thumbnail.length === 0) {
      throw new Error('Banner SkyVerse tidak valid atau kosong.');
    }

    const sent = await ctx.socket.sendMessage(ctx.chatId, {
      text: buildAllMenu(ctx),
      contextInfo: {
        externalAdReply: {
          title: 'SkyVerse',
          body: 'All-in-one WhatsApp virtual bot assistant.',
          mediaType: 1,
          thumbnail,
          sourceUrl: SUPPORT_URL,
          renderLargerThumbnail: true,
        },
      },
    });

    if (!sent?.key?.id) {
      throw new Error('Baileys tidak mengembalikan message key untuk allmenu.');
    }
  },
};