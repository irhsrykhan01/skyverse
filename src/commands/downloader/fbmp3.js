import { findDownloaderUrl } from '../../services/providers/downloader-response.js';
import { downloadMediaSource, findMediaSource } from '../../services/providers/media-response.js';

export const command = {
  name: 'fbmp3',
  description: 'Mengambil audio dari Facebook.',
  category: 'downloader',
  aliases: [],
  usage: 'fbmp3 <url>',
  permission: 'user',
  minArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.facebook(ctx.parsed.args[0]);
    const source = findMediaSource(response?.result ?? response, {
      baseUrl: ctx.config.depayBaseUrl,
    });
    if (!source) {
      const url = findDownloaderUrl(response, { kind: 'video' });
      if (!url) throw new Error(response?.error?.message ?? 'Facebook tidak mengembalikan media yang dapat diunduh.');
      const buffer = await downloadMediaSource({ kind: 'url', value: url });
      const audio = await ctx.media.toMp3(buffer);
      await ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: 'skyverse-facebook.mp3' });
      return;
    }

    const buffer = await downloadMediaSource(source);
    const audio = await ctx.media.toMp3(buffer);
    await ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: 'skyverse-facebook.mp3' });
  },
};
