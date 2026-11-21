import { findDownloaderUrl } from '../../services/providers/downloader-response.js';
import { downloadMediaSource } from '../../services/providers/media-response.js';

function getFileName(result, url) {
  const supplied = result?.fileName ?? result?.filename ?? result?.name ?? result?.title;
  const fromUrl = (() => {
    try { return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? ''); }
    catch { return ''; }
  })();
  const value = String(supplied ?? fromUrl ?? 'skyverse-download').trim();
  const safe = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
  return safe || 'skyverse-download';
}

export const command = {
  name: 'mediafire',
  description: 'Download file dari MediaFire.',
  category: 'downloader',
  aliases: ['mf'],
  usage: 'mediafire <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.mediafire(ctx.parsed.args[0]);
    const url = findDownloaderUrl(response, { kind: 'auto' });
    if (!url) throw new Error(response?.message ?? 'MediaFire tidak mengembalikan tautan unduhan.');

    const source = await downloadMediaSource({ kind: 'url', value: url }, { maxBytes: 50 * 1024 * 1024 });
    const result = response?.result ?? response?.data ?? response;
    const fileName = getFileName(result, url);
    const extension = fileName.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
    const mimeTypes = {
      apk: 'application/vnd.android.package-archive',
      pdf: 'application/pdf',
      zip: 'application/zip',
      rar: 'application/vnd.rar',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    await ctx.media.send(source, 'document', {
      fileName,
      mimetype: mimeTypes[extension] ?? 'application/octet-stream',
    });
  },
};
