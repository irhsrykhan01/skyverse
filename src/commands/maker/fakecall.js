import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakecall',
  description: 'Membuat mockup panggilan ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockcall'],
  usage: 'fakecall <nama> | <durasi>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, duration = '06:52'] = splitFields(ctx.parsed.argumentText, 2);
    await sendMock(ctx, {
      title: 'CALL MOCKUP',
      fields: [
        { label: 'Nama', value: name || ctx.message?.pushName || 'User' },
        { label: 'Durasi', value: duration || '06:52' },
        { label: 'Status', value: 'Demo call screen' },
      ],
    });
  },
};
