import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakettcomment',
  description: 'Membuat mockup komentar sosial ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockttcomment'],
  usage: 'fakettcomment <komentar> | <username> | <waktu>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [comment, username = 'user', time = '1m'] = splitFields(ctx.parsed.argumentText, 3);
    await sendMock(ctx, {
      title: 'COMMENT MOCKUP',
      fields: [
        { label: 'Username', value: username },
        { label: 'Komentar', value: comment },
        { label: 'Waktu', value: time },
      ],
    });
  },
};
