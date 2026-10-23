import fs from 'node:fs';
import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

const SUPPORT_URL = 'https://saweria.co/irhsrykhn';
const BANNER_PATH = new URL('../../../assets/SkyLabs_banner.jpg', import.meta.url);

function buildMenuBody(ctx) {
  const user = ctx.user ?? {};
  const coin = Number(user.coins ?? 0);
  const tier = user.is_premium ? 'Premium User' : 'Free User';
  const tag = ctx.senderJid?.split('@')[0] ?? 'User';

  return [
    '╭── ＳＫＹＶＥＲＳＥ ──',
    `│ Halo, @${tag}!`,
    `│ Koin: ${coin}`,
    `│ Tier: ${tier}`,
    '╰───────────────',
    'Selamat datang di Skyverse Bot!. ☁',
    '> SkyVerse adalah bot WhatsApp atau asisten virtual WhatsApp yang siap bantu kamu bikin stiker, download video, sampai main game seru!',
    '',
    'Butuh bantuan atau ingin request fitur? Ketik *.owner* untuk menghubungi admin.',
    '',
    '💡 Dukung SkyVerse:',
    SUPPORT_URL,
  ].join('\n');
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu interaktif SkyVerse.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    const thumbnail = fs.readFileSync(BANNER_PATH);
    if (!Buffer.isBuffer(thumbnail) || thumbnail.length === 0) {
      throw new Error('Banner SkyVerse tidak valid atau kosong.');
    }

    await sendA2UIMenu(ctx.socket, ctx.chatId, {
      config: ctx.config,
      registry: ctx.registry,
      body: buildMenuBody(ctx),
      externalAdReply: {
        title: 'SkyVerse',
        body: 'All-in-one WhatsApp virtual bot assistant.',
        mediaType: 1,
        thumbnail,
        renderLargerThumbnail: true,
        sourceUrl: SUPPORT_URL,
      },
    });
  },
};
