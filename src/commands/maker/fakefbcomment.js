import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakefbcomment',
  description: 'Membuat mockup komentar sosial ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockfbcomment'],
  usage: 'fakefbcomment <komentar> | <nama>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [comment, name = 'User'] = splitFields(ctx.parsed.argumentText, 2);
    await sendMock(ctx, {
      title: 'COMMENT MOCKUP',
      fields: [
        { label: 'Nama', value: name },
        { label: 'Komentar', value: comment },
        { label: 'Platform', value: 'Social media demo' },
      ],
    });
  },
};
