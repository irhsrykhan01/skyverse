import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

function buildMenuBody(ctx) {
  const user = ctx.user ?? {};
  const coin = Number(user.coins ?? 0);
  const limit = Number(user.limit ?? 20);
  const tier = user.is_premium ? 'Premium User' : 'Free User';
  const tag = ctx.senderJid?.split('@')[0] ?? 'User';

  return [
    '╭── ＳＫＹＶＥＲＳＥ ──',
    `│ Halo, @${tag}!`,
    `│ Koin: ${coin}`,
    `│ Limit: ${limit}`,
    `│ Tier: ${tier}`,
    '╰───────────────',
    'Selamat datang di Skyverse Bot!. ☁',
    '> SkyVerse adalah bot WhatsApp atau asisten virtual WhatsApp yang siap bantu kamu bikin stiker, download video, sampai main game seru!',
    '',
    '⚠️ *Limit habis atau pengen fitur eksklusif?*',
    'Yuk, upgrade ke Premium biar bebas limit! Ketik *.owner* untuk menghubungi admin.',
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
    await sendA2UIMenu(ctx.socket, ctx.chatId, {
      config: ctx.config,
      registry: ctx.registry,
      body: buildMenuBody(ctx),
    });
  },
};
