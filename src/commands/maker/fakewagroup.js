import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakewagroup',
  description: 'Membuat mockup grup chat ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockgroup'],
  usage: 'fakewagroup <nama> | <anggota> | <deskripsi> | <admin>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, members = '128', description = 'SkyVerse Community', admin = 'Admin'] = splitFields(ctx.parsed.argumentText, 4);
    await sendMock(ctx, {
      title: 'GROUP MOCKUP',
      fields: [
        { label: 'Nama grup', value: name },
        { label: 'Anggota', value: members },
        { label: 'Deskripsi', value: description },
        { label: 'Admin', value: admin },
      ],
    });
  },
};
