const DEFAULT_NEW_USER_COINS = 100;
const MIN_CLAIM_COINS = 2;
const MAX_CLAIM_COINS = 7;
const CLAIM_COOLDOWN_MS = 3 * 60 * 60 * 1000;

export class EconomyManager {
  constructor({ repositories }) {
    if (!repositories?.users) throw new Error('EconomyManager membutuhkan repositories.users.');
    this.repositories = repositories;
  }

  getUser(id) {
    return this.repositories.users.get(id);
  }

  ensureUser(id, { pushName = null, isBot = false } = {}) {
    if (!id) throw new Error('Economy user ID wajib diisi.');
    const result = this.repositories.users.upsert({ jid: id, pushName, isBot });
    return result.user;
  }

  getCoins(id) {
    return Number(this.ensureUser(id)?.coins ?? 0);
  }

  getWallet(id) {
    const user = this.ensureUser(id);
    return Object.freeze({
      id: user.jid,
      coins: Number(user.coins) || 0,
      isPremium: Boolean(user.is_premium),
      premiumUntil: user.premium_until == null ? null : Number(user.premium_until),
      lastClaimAt: Number(user.last_claim_at) || 0,
    });
  }

  addCoins(id, amount, reason = 'unknown') {
    const user = this.ensureUser(id);
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    const balance = Math.max(0, Number(user.coins) || 0) + value;
    this.repositories.users.updateWallet(id, {
      coins: balance,
      isPremium: Boolean(user.is_premium),
      premiumUntil: user.premium_until,
      lastClaimAt: user.last_claim_at,
    });
    this.repositories.economy.transactions({ userJid: id, type: 'credit', amount: value, balanceAfter: balance, reason });
    return balance;
  }

  spendCoins(id, amount, reason = 'feature') {
    const user = this.ensureUser(id);
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    const balance = Math.max(0, Number(user.coins) || 0);
    if (balance < value) return { ok: false, balance, required: value };

    const nextBalance = balance - value;
    this.repositories.users.updateWallet(id, {
      coins: nextBalance,
      isPremium: Boolean(user.is_premium),
      premiumUntil: user.premium_until,
      lastClaimAt: user.last_claim_at,
    });
    this.repositories.economy.transactions({ userJid: id, type: 'debit', amount: value, balanceAfter: nextBalance, reason });
    return { ok: true, balance: nextBalance, spent: value };
  }

  canClaim(id, now = Date.now()) {
    const user = this.ensureUser(id);
    const lastClaim = Number(user.last_claim_at) || 0;
    const remaining = Math.max(0, CLAIM_COOLDOWN_MS - (now - lastClaim));
    return { ok: remaining === 0, remaining, nextClaimAt: now + remaining };
  }

  claim(id, now = Date.now()) {
    const user = this.ensureUser(id);
    const status = this.canClaim(id, now);
    const balance = Math.max(0, Number(user.coins) || 0);
    if (!status.ok) return { ok: false, remaining: status.remaining, balance };

    const amount = Math.floor(Math.random() * (MAX_CLAIM_COINS - MIN_CLAIM_COINS + 1)) + MIN_CLAIM_COINS;
    const nextBalance = balance + amount;
    this.repositories.users.updateWallet(id, {
      coins: nextBalance,
      isPremium: Boolean(user.is_premium),
      premiumUntil: user.premium_until,
      lastClaimAt: now,
    });
    this.repositories.economy.transactions({ userJid: id, type: 'credit', amount, balanceAfter: nextBalance, reason: 'claim', at: now });
    return { ok: true, amount, balance: nextBalance, nextClaimAt: now + CLAIM_COOLDOWN_MS };
  }
}

export const economyDefaults = Object.freeze({
  newUserCoins: DEFAULT_NEW_USER_COINS,
  claimCooldownMs: CLAIM_COOLDOWN_MS,
  claimReward: [MIN_CLAIM_COINS, MAX_CLAIM_COINS],
});
