import { normalizePhoneNumber } from '../../security/identity.js';
import { formatCoins } from '../../economy/config.js';

function getMentionedJid(message) {
  const contexts = [
    message?.message?.extendedTextMessage?.contextInfo,
    message?.message?.imageMessage?.contextInfo,
    message?.message?.videoMessage?.contextInfo,
    message?.message?.documentMessage?.contextInfo,
  ];
  for (const context of contexts) {
    if (Array.isArray(context?.mentionedJid) && context.mentionedJid[0]) return String(context.mentionedJid[0]);
  }
  return null;
}

function resolveTarget(ctx) {
  const mentioned = getMentionedJid(ctx.message);
  if (mentioned) {
    const amount = Number(ctx.parsed.args.find((item) => /^\d+$/.test(String(item))));
    return { jid: mentioned, amount };
  }
  const [rawTarget, rawAmount] = ctx.parsed.args;
  const number = normalizePhoneNumber(rawTarget);
  if (!number) return { jid: null, amount: Number(rawAmount) };
  const user = ctx.repositories.users.findByNumber(number);
  return { jid: user?.jid ?? null, amount: Number(rawAmount) };
}

export const command = {
  name: 'pay',
  description: 'Mengirim Coin ke pengguna lain secara atomik.',
  category: 'economy',
  access: 'npc',
  aliases: ['transfer', 'kirimcoin'],
  usage: 'pay @user <jumlah> atau pay <nomor> <jumlah>',
  permission: 'user',
  minArgs: 1,
  maxArgs: 2,
  cooldown: 2000,
  cost: 0,
  async execute(ctx) {
    const { jid: target, amount } = resolveTarget(ctx);
    if (!target) throw new Error('Penerima belum terdaftar di SkyVerse atau format nomor tidak sesuai. Contoh: pay @user 100');
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Jumlah Coin harus bilangan bulat minimal 1.');

    const result = ctx.economy.transfer(ctx.senderJid, target, amount, 'user:transfer');
    if (!result.ok) {
      if (result.reason === 'self_transfer') throw new Error('Kamu tidak bisa mengirim Coin ke diri sendiri.');
      if (result.reason === 'recipient_not_found') throw new Error('Penerima belum terdaftar di SkyVerse.');
      if (result.reason === 'insufficient_funds') throw new Error(`Coin tidak cukup. Saldo kamu ${formatCoins(result.balance)} 🪙.`);
      throw new Error('Transfer Coin gagal.');
    }

    const xp = ctx.profile?.addXp(ctx.senderJid, 5, 'economy:transfer');

    await ctx.reply([
      '✅ *TRANSFER BERHASIL*',
      `Kirim: ${formatCoins(result.amount)} 🪙`,
      `Biaya: ${formatCoins(result.fee ?? 0)} 🪙`,
      `+${xp?.added ?? 0} XP ✨`,
      `Saldo kamu: ${formatCoins(result.senderBalance)} 🪙`,
      `Penerima: @${String(target).split('@')[0]}`,
      `Saldo penerima: ${formatCoins(result.recipientBalance)} 🪙`,
      xp?.leveledUp ? `🎉 *LEVEL UP!* Sekarang Level ${xp.level} — ${xp.title}` : '',
    ].filter(Boolean).join('\n'), {
      sendOptions: target.includes('@') ? { mentions: [target] } : {},
    });
  },
};