import { sendApiImage, splitFields } from './_fields.js';

export const command = {
  name: 'fakecall',
  description: 'Membuat tampilan panggilan WhatsApp melalui API maker.',
  category: 'maker',
  aliases: ['mockcall'],
  usage: 'fakecall <nama> | <durasi>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [rawName, duration = ''] = splitFields(ctx.parsed.argumentText, 2);
    const name = rawName || ctx.message?.pushName || 'User';
    const result = await ctx.providers.sairiHostMakers.fakeCall(name, duration);
    await sendApiImage(ctx, result);
  },
};
