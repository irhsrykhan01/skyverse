import { sendA2UIMenu } from '../../platform/whatsapp/a2ui.js';

const CATEGORY_META = Object.freeze({
  general: { icon: '✦', label: 'General', order: 1 },
  group: { icon: '◈', label: 'Group', order: 2 },
  sticker: { icon: '◆', label: 'Sticker & Media', order: 3 },
  downloader: { icon: '↧', label: 'Downloader', order: 4 },
  tools: { icon: '⚙', label: 'Tools', order: 5 },
  system: { icon: '◇', label: 'System', order: 99 },
});

function titleFor(category) {
  const key = String(category).toLowerCase();
  return CATEGORY_META[key] ?? { icon: '•', label: key.charAt(0).toUpperCase() + key.slice(1), order: 50 };
}

function buildTextMenu(ctx) {
  const groups = ctx.registry.byCategory({ includeHidden: false });
  const orderedGroups = [...groups.entries()].sort((a, b) => titleFor(a[0]).order - titleFor(b[0]).order || a[0].localeCompare(b[0]));
  const visibleCommands = ctx.registry.all({ includeHidden: false });
  const lines = [
    'https://saweria.co/irhsrykhn',
    '',
    '╭━━━〔 *SKYVERSE* 〕━━━╮',
    `┃ ✦ *Bot*      : ${ctx.config.botName}`,
    '┃ ✦ *Status*   : Online',
    `┃ ✦ *Prefix*   : ${ctx.config.prefix}`,
    `┃ ✦ *Commands* : ${visibleCommands.length}`,
    `┃ ✦ *Category* : ${orderedGroups.length}`,
    '╰━━━━━━━━━━━━━━━━━━━━╯',
    '',
    '╭─〔 *QUICK HELP* 〕',
    `│ ${ctx.config.prefix}help <command>`,
    `│ ${ctx.config.prefix}ping`,
    '╰────────────────────',
  ];

  for (const [category, commands] of orderedGroups) {
    const meta = titleFor(category);
    lines.push('', `┌─〔 ${meta.icon} *${meta.label.toUpperCase()}* 〕`);
    for (const item of commands) {
      const alias = item.aliases[0] ? ` (${ctx.config.prefix}${item.aliases[0]})` : '';
      lines.push(`│ ${ctx.config.prefix}${item.name}${alias}`);
    }
    lines.push('└────────────────────');
  }

  lines.push('', `Ketik *${ctx.config.prefix}help <command>* untuk detail command.`);
  return lines.join('\n');
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu SkyVerse.',
  category: 'general',
  aliases: ['allmenu'],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    try {
      await sendA2UIMenu(ctx.socket, ctx.chatId, ctx);
    } catch (error) {
      // Keep the classic menu as a compatibility fallback for clients that
      // reject Native Flow messages.
      await ctx.reply(buildTextMenu(ctx));
    }
  },
};
