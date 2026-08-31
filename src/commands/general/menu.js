import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

function buildPreview(ctx) {
  const user = ctx.user;
  const coin = Number(user?.coins ?? 0);
  const limit = Number(user?.limit ?? 20);
  const tier = user?.is_premium ? 'Premium User' : 'Free User';
  const tag = ctx.senderJid?.split('@')[0] ?? 'User';

  return [
    'https://saweria.co/irhsrykhn',
    '',
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
    '',
    ' ❏ *Fitur Bot*',
    `├ ${ctx.config.prefix}sticker`,
    `├ ${ctx.config.prefix}hd`,
    `└ ${ctx.config.prefix}tts`,
    '',
    ' ❏ *Ekonomi*',
    `├ ${ctx.config.prefix}claim`,
    `├ ${ctx.config.prefix}topup`,
    `└ ${ctx.config.prefix}buyprem`,
    '',
    ' ❏ *Creator*',
    `├ ${ctx.config.prefix}roblox`,
    `└ ${ctx.config.prefix}render`,
  ].join('\\n');
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu interaktif SkyVerse.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    try {
      await sendA2UIMenu(ctx.socket, ctx.chatId, ctx, { previewText: buildPreview(ctx) });
    } catch {
      await ctx.reply(buildPreview(ctx));
    }
  },
};
