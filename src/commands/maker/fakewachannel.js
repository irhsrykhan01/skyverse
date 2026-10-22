import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakewachannel',
  description: 'Membuat mockup channel ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockchannel'],
  usage: 'fakewachannel <nama> | <followers> | <deskripsi>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, followers = '1000', description = 'SkyVerse updates'] = splitFields(ctx.parsed.argumentText, 3);
    await sendMock(ctx, {
      title: 'CHANNEL MOCKUP',
      fields: [
        { label: 'Nama', value: name },
        { label: 'Followers', value: followers },
        { label: 'Deskripsi', value: description },
      ],
    });
  },
};
