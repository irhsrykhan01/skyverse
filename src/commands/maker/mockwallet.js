import { sendMock, splitFields } from './_mock.js';

export const command = {
  name: 'mockwallet',
  description: 'Membuat kartu e-wallet generik ber-watermark DEMO; bukan bukti pembayaran.',
  category: 'maker',
  aliases: ['demowallet'],
  usage: 'mockwallet <nama> | <nominal> | <catatan>',
  permission: 'user',
  minArgs: 1,
  cooldown: 3000,
  async execute(ctx) {
    const [name, amount = 'Rp0', note = 'Demo only'] = splitFields(ctx.parsed.argumentText, 3);
    await sendMock(ctx, {
      title: 'E-WALLET DEMO',
      subtitle: 'Bukan bukti transaksi',
      fields: [
        { label: 'Nama', value: name },
        { label: 'Nominal contoh', value: amount },
        { label: 'Catatan', value: note },
        { label: 'Status', value: 'DEMO — TIDAK VALID UNTUK PEMBAYARAN' },
      ],
    });
  },
};
