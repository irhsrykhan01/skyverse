import { sendApiImage, splitFields } from './_fields.js';

export const command = {
  name: 'fakettcomment',
  description: 'Membuat tampilan komentar TikTok melalui API maker.',
  category: 'maker',
  aliases: ['mockttcomment'],
  usage: 'fakettcomment <komentar> | <nama> | <teks video> | <likes> | <balasan>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [comment, rawName = '', videoText = '', likes = '', reply = ''] = splitFields(ctx.parsed.argumentText, 5);
    const name = rawName || ctx.message?.pushName || 'User';
    const result = await ctx.providers.sairiHostMakers.fakeTikTokComment(name, comment, videoText, likes, reply);
    await sendApiImage(ctx, result);
  },
};
