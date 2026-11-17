import { normalizeTikTokUrl } from '../../services/providers/tiktok-url.js';

export const command = {
  name: 'ttmp3',
  description: 'Mengambil audio MP3 dari TikTok.',
  category: 'downloader',
  aliases: [],
  usage: 'ttmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const url = normalizeTikTokUrl(ctx.parsed.args[0]);
    const result = await ctx.providers.downloader.tiktokMedia(url, {
      kind: 'audio',
      fallbackToVideo: true,
    });
    const audio = await ctx.media.toMp3(result.buffer);
    if (!Buffer.isBuffer(audio) || audio.length < 1024) {
      throw new Error('Audio hasil konversi TikTok tidak valid.');
    }
    await ctx.media.send(audio, 'audio', {
      mimetype: 'audio/mpeg',
      fileName: 'skyverse-tiktok.mp3',
    });
  },
};
