import fs from 'node:fs';

const SUPPORT_URL = 'https://saweria.co/irhsrykhn';
const BANNER_PATH = new URL('../../../assets/SkyLabs_banner.jpg', import.meta.url);

const GENERAL_COMMANDS = Object.freeze([
  'afk',
  'allmenu',
  'delete',
  'help',
  'info',
  'leaderboard',
  'menu',
  'owner',
  'ping',
]);

function buildMenu(ctx) {
  const tag = ctx.senderJid?.split('@')[0] ?? 'User';
  const tier = ctx.user?.is_premium ? 'Premium User' : 'Free User';
  const total = ctx.registry.all({ includeHidden: false }).length;
  const available = new Set(
    ctx.registry.all({ includeHidden: false }).map((item) => item.name),
  );

  const commandLines = GENERAL_COMMANDS
    .filter((name) => available.has(name))
    .map((name) => `⊛ ${ctx.config.prefix}${name}`);

  return [
    '❖  *SKYVERSE*  ❖',
    '───────────────',
    `Halo, @${tag}`,
    `⋄ Status : ${tier}`,
    `⋄ Total  : ${total} Commands`,
    '───────────────',
    '> _All-in-one WhatsApp virtual bot assistant._',
    '',
    '⚝ *GENERAL MENU*',
    ...commandLines,
    '',
    '───────────────',
    '💡 Dukung SkyVerse:',
    SUPPORT_URL,
  ].join('\n');
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu utama SkyVerse.',
  category: 'general',
  aliases: [],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    const thumbnail = fs.readFileSync(BANNER_PATH);
    if (!Buffer.isBuffer(thumbnail) || thumbnail.length === 0) {
      throw new Error('Banner SkyVerse tidak valid atau kosong.');
    }

    const mentionedJid = ctx.senderJid ? [ctx.senderJid] : [];
    const content = {
      text: buildMenu(ctx),
      mentions: mentionedJid,
      contextInfo: {
        mentionedJid,
        externalAdReply: {
          title: 'SkyVerse',
          body: 'All-in-one WhatsApp virtual bot assistant.',
          mediaType: 1,
          previewType: 'PHOTO',
          thumbnail,
          renderLargerThumbnail: true,
          showAdAttribution: false,
          sourceUrl: SUPPORT_URL,
          mediaUrl: SUPPORT_URL,
        },
      },
    };

    const options = ctx.isChannel || ctx.isBroadcast
      ? {}
      : { quoted: ctx.message };

    await ctx.socket.sendMessage(ctx.chatId, content, options);
  },
};
