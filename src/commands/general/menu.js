import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CATEGORY_META = Object.freeze({
  general: { icon: '✦', label: 'General', order: 1 },
  group: { icon: '◈', label: 'Group', order: 2 },
  sticker: { icon: '◆', label: 'Sticker & Media', order: 3 },
  downloader: { icon: '↧', label: 'Downloader', order: 4 },
  tools: { icon: '⚙', label: 'Tools', order: 5 },
  system: { icon: '◇', label: 'System', order: 99 },
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const defaultBannerPath = join(repoRoot, 'file_000000007a90720880001aa9bde3c4b7.png');

function titleFor(category) {
  const key = String(category).toLowerCase();
  return CATEGORY_META[key] ?? { icon: '•', label: key.charAt(0).toUpperCase() + key.slice(1), order: 50 };
}

async function loadBannerThumbnail(config) {
  const configured = config.menuBannerImage?.trim();
  if (!configured) return null;

  if (/^https?:\/\//i.test(configured)) {
    return { thumbnailUrl: configured };
  }

  const path = configured.startsWith('./') ? join(repoRoot, configured.slice(2)) : configured;
  return { thumbnail: await readFile(path) };
}

async function sendMenuBanner(ctx) {
  if (!ctx.config.menuBannerEnabled || !ctx.config.menuBannerLink) return;

  try {
    const image = await loadBannerThumbnail(ctx.config);
    if (!image) return;

    const externalAdReply = {
      title: ctx.config.menuBannerTitle,
      body: ctx.config.menuBannerBody,
      mediaType: 1,
      sourceUrl: ctx.config.menuBannerLink,
      renderLargerThumbnail: true,
      showAdAttribution: false,
      thumbnailUrl: image.thumbnailUrl,
      thumbnail: image.thumbnail,
    };

    await ctx.reply(ctx.config.menuBannerTitle, {
      sendOptions: {
        contextInfo: {
          externalAdReply,
        },
      },
    });
  } catch (error) {
    console.warn('Menu banner unavailable:', error?.message ?? String(error));
  }
}

export const command = {
  name: 'menu',
  description: 'Menampilkan menu SkyVerse.',
  category: 'general',
  aliases: ['allmenu'],
  permission: 'user',
  usage: 'menu',
  async execute(ctx) {
    await sendMenuBanner(ctx);

    const groups = ctx.registry.byCategory({ includeHidden: false });
    const orderedGroups = [...groups.entries()].sort((a, b) => titleFor(a[0]).order - titleFor(b[0]).order || a[0].localeCompare(b[0]));
    const visibleCommands = ctx.registry.all({ includeHidden: false });
    const lines = [
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
    await ctx.reply(lines.join('\n'));
  },
};
