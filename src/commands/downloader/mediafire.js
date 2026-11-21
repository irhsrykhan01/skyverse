import { findDownloaderUrl } from '../../services/providers/downloader-response.js';
import { downloadMediaSource } from '../../services/providers/media-response.js';

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
    const url = findDownloaderUrl(response, { kind: 'video' })
      ?? findDownloaderUrl(response, { kind: 'image' })
      ?? findDownloaderUrl(response, { kind: 'audio' });
    if (!url) throw new Error('Link file MediaFire tidak ditemukan atau file tidak dapat diakses.');

    const buffer = await downloadMediaSource({ kind: 'url', value: url, expectedType: null }, { maxBytes: 50 * 1024 * 1024 });
    const data = response?.data ?? response?.result ?? response;
    const filename = String(data?.fileName ?? data?.filename ?? 'skyverse-mediafire-file').slice(0, 120);
    await ctx.media.send(buffer, 'document', {
      mimetype: data?.mimeType ?? data?.mimetype ?? 'application/octet-stream',
      fileName: filename,
    });
  },
};
