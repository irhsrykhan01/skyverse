import { sendApiImage, splitFields } from './_fields.js';

export const command = {
  name: 'mockwallet',
  description: 'Membuat gambar mockup saldo DANA melalui API; hanya untuk demo/parodi.',
  category: 'maker',
  aliases: ['demowallet'],
  usage: 'mockwallet <nominal>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [nominal] = splitFields(ctx.parsed.argumentText, 1);
    const result = await ctx.providers.berakNewMakers.fakeDana(nominal);
    await sendApiImage(ctx, result, 'DEMO / PARODY — saldo fiktif, bukan bukti saldo atau pembayaran.');
  },
};
