import { getMenuCategoryLabel, orderMenuCategories } from '../../core/menu-categories.js';

function commandMap(commands) {
  return new Map(commands.map((command) => [command.name, command]));
}

function buildDownloaderMenu(prefix, commands) {
  const byName = commandMap(commands);
  const main = [
    { name: 'facebook', label: 'facebook', children: ['fbmp3'] },
    { name: 'instagram', label: 'instagram', children: [] },
    { name: 'tiktok', label: 'tiktok', children: ['ttmp3'] },
    { name: 'youtube', label: 'youtube', children: ['ytmp3'] },
  ];

  const lines = [' ❏ *Downloader*'];
  const visibleMain = main.filter((entry) => byName.has(entry.name));
  visibleMain.forEach((entry, index) => {
    const isLast = index === visibleMain.length - 1;
    lines.push(`${isLast ? '└' : '├'} ${prefix}${entry.label}`);
    const children = entry.children.filter((name) => byName.has(name));
    children.forEach((name, childIndex) => {
      const childBranch = childIndex === children.length - 1 ? '└' : '├';
      lines.push(`     ${childBranch} ${prefix}${name}`);
    });
  });
  return lines;
}

function buildAllMenu(ctx) {
  const groups = ctx.registry.byCategory({ includeHidden: false });
  const ordered = orderMenuCategories(groups);
  const total = ctx.registry.all({ includeHidden: false }).length;
  const lines = [
    'https://saweria.co/irhsrykhn',
    '',
    '╭── ＳＫＹＶＥＲＳＥ ──',
    `│ Halo, @${ctx.senderJid?.split('@')[0] ?? 'User'}!`,
    `│ Koin: ${Number(ctx.user?.coins ?? 0)}`,
    `│ Limit: ${Number(ctx.user?.limit ?? 20)}`,
    `│ Tier: ${ctx.user?.is_premium ? 'Premium User' : 'Free User'}`,
    '╰───────────────',
    'Selamat datang di Skyverse Bot!. ☁',
    '> SkyVerse adalah bot WhatsApp atau asisten virtual WhatsApp yang siap bantu kamu bikin stiker, download video, sampai main game seru!',
    '',
    `Total Command: ${total}`,
  ];

  for (const [category, commands] of ordered) {
    if (category === 'downloader') {
      lines.push('', ...buildDownloaderMenu(ctx.config.prefix, commands));
      continue;
    }

    lines.push('', ` ❏ *${getMenuCategoryLabel(category)}*`);
    commands.forEach((item, index) => {
      const branch = index === commands.length - 1 ? '└' : '├';
      lines.push(`${branch} ${ctx.config.prefix}${item.name}`);
    });
  }

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
    await ctx.reply(buildAllMenu(ctx));
  },
};
