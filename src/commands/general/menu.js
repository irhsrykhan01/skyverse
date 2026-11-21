import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

function buildMenuBody(ctx) {
  const commands = ctx.registry.all({ includeHidden: false });
  const userNumber = ctx.senderNumber
    ? '+' + String(ctx.senderNumber).replace(/^\+/, '')
    : '+' + (ctx.senderJid?.split('@')[0] ?? 'Tidak tersedia');
  const tier = ctx.isOwner
    ? 'Owner'
    : ctx.user?.is_premium
      ? 'Premium User'
      : 'Free User';

  return [
    '╭───〔 *SKYVERSE BOT* 〕───',
    '│',
    '│ ◦ *User*          : ' + userNumber,
    '│ ◦ *Tier*          : ' + tier,
    '│ ◦ *Total Command* : ' + commands.length + ' Commands',
    '│',
    '╰────────────────────',
    'Selamat datang di Skyverse Bot!. ☁',
    '',
    '> SkyVerse adalah bot WhatsApp atau asisten virtual WhatsApp yang siap bantu kamu bikin stiker, download video, sampai main game seru!',
    '',
    'Butuh bantuan atau ingin request fitur? Ketik *.owner* untuk menghubungi admin.',
  ].join('\n');
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu utama SkyVerse dengan A2UI.',
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
