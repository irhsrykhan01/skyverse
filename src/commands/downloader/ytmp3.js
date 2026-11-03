import { sendVideoAsMp3 } from './_generic.js';

export const command = {
  name: 'ytmp3',
  description: 'Konversi audio YouTube menjadi MP3 melalui FFmpeg lokal.',
  category: 'downloader',
  aliases: [],
  usage: 'ytmp3 <url>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 5000,
  async execute(ctx) {
    const response = await ctx.providers.downloader.youtube(ctx.parsed.args[0]);
    await sendVideoAsMp3(ctx, response, 'skyverse-youtube.mp3');
  },
};
