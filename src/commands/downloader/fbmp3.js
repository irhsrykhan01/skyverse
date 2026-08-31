import { findDownloaderUrl } from '../../services/providers/downloader-response.js';
import { downloadMediaSource } from '../../services/providers/media-response.js';

export const command = {
  name: 'fbmp3',
  description: 'Mengambil audio dari Facebook.',
  category: 'downloader',
  aliases: [],
  usage: 'fbmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.facebook(ctx.parsed.args[0]);
    const audioUrl = findDownloaderUrl(response, { kind: 'audio' });
    if (audioUrl) {
      const buffer = await downloadMediaSource({ kind: 'url', value: audioUrl });
      const audio = await ctx.media.toMp3(buffer);
      await ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: 'skyverse-facebook.mp3' });
      return;
    }

    const videoUrl = findDownloaderUrl(response, { kind: 'video' });
    if (!videoUrl) throw new Error(response?.error?.message ?? 'Facebook tidak mengembalikan media yang dapat diunduh.');
    const buffer = await downloadMediaSource({ kind: 'url', value: videoUrl });
    const audio = await ctx.media.toMp3(buffer);
    await ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: 'skyverse-facebook.mp3' });
  },
};
