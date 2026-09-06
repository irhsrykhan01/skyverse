import { findDownloaderUrl } from '../../services/providers/downloader-response.js';
import { downloadMediaSource } from '../../services/providers/media-response.js';

export const command = {
  name: 'ytmp3',
  description: 'Download audio MP3 dari YouTube.',
  category: 'downloader',
  aliases: [],
  usage: 'ytmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.youtubeMp3(ctx.parsed.args[0]);
    const audioUrl = findDownloaderUrl(response, { kind: 'audio' });
    const videoUrl = findDownloaderUrl(response, { kind: 'video' });
    const sourceUrl = audioUrl ?? videoUrl;
    if (!sourceUrl) throw new Error(response?.error?.message ?? 'YouTube tidak mengembalikan media audio/video yang dapat diproses.');

    const source = await downloadMediaSource({ kind: 'url', value: sourceUrl });
    const audio = await ctx.media.toMp3(source);
    await ctx.media.send(audio, 'audio', { mimetype: 'audio/mpeg', fileName: 'skyverse-youtube.mp3' });
  },
};
