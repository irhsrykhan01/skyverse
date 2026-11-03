import { sendVideoAsMp3 } from './_generic.js';

export const command = {
  name: 'igmp3',
  description: 'Konversi audio Instagram Reel menjadi MP3 melalui FFmpeg lokal.',
  category: 'downloader',
  aliases: [],
  usage: 'igmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.instagram(ctx.parsed.args[0]);
    await sendVideoAsMp3(ctx, response, 'skyverse-instagram.mp3');
  },
};
