import { sendApiImage, splitFields } from './_fields.js';

export const command = {
  name: 'fakewachannel',
  description: 'Membuat tampilan info Saluran WhatsApp melalui API maker.',
  category: 'maker',
  aliases: ['mockchannel'],
  usage: 'fakewachannel <nama> | <followers> | <jam>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, followers = '', time = ''] = splitFields(ctx.parsed.argumentText, 3);
    const result = await ctx.providers.sairiHostMakers.fakeChannel(name, followers, time);
    await sendApiImage(ctx, result);
  },
};
