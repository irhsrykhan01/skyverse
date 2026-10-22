import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'fakettprofile',
  description: 'Membuat mockup profil sosial ber-watermark DEMO.',
  category: 'maker',
  aliases: ['mockttprofile'],
  usage: 'fakettprofile <nama> | <username> | <following> | <followers> | <likes>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, username, following = '10', followers = '100', likes = '1000'] = splitFields(ctx.parsed.argumentText, 5);
    await sendMock(ctx, {
      title: 'SOCIAL PROFILE MOCKUP',
      fields: [
        { label: 'Nama', value: name },
        { label: 'Username', value: username },
        { label: 'Following', value: following },
        { label: 'Followers', value: followers },
        { label: 'Likes', value: likes },
      ],
    });
  },
};
