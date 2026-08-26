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
  const target = configured || defaultBannerPath;
  if (/^https?:\/\//i.test(target)) return { thumbnailUrl: target };

  const path = target.startsWith('./') ? join(repoRoot, target.slice(2)) : target;
  return { thumbnail: await readFile(path) };
}

async function buildExternalAdReply(ctx) {
  if (!ctx.config.menuBannerEnabled || !ctx.config.menuBannerLink) return null;

  try {
    const image = await loadBannerThumbnail(ctx.config);
    const externalAdReply = {
      title: 'SkyVerse Bot',
      body: 'Automated WhatsApp Assistant',
      mediaType: 1,
      sourceUrl: ctx.config.menuBannerLink,
      renderLargerThumbnail: true,
      showAdAttribution: false,
    };

    if (image.thumbnailUrl) externalAdReply.thumbnailUrl = image.thumbnailUrl;
    if (image.thumbnail) externalAdReply.thumbnail = image.thumbnail;
    return externalAdReply;
  } catch (error) {
    console.warn('Menu banner unavailable:', error?.message ?? String(error));
    return null;
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
    const text = lines.join('\n');
    const externalAdReply = await buildExternalAdReply(ctx);

    if (externalAdReply) {
      await ctx.reply(text, {
        sendOptions: {
          contextInfo: { externalAdReply },
        },
      });
    } else {
      await ctx.reply(text);
    }
  },
};
