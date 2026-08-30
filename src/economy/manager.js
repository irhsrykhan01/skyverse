const DEFAULT_NEW_USER_COINS = 100;
const MIN_CLAIM_COINS = 2;
const MAX_CLAIM_COINS = 7;
const CLAIM_COOLDOWN_MS = 3 * 60 * 60 * 1000;

function validAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export class EconomyManager {
  constructor({ repositories }) {
    if (!repositories?.users || !repositories?.economy) {
      throw new Error('EconomyManager membutuhkan repositories.users dan repositories.economy.');
    }
    this.repositories = repositories;
  }

  getUser(id) {
    return this.repositories.users.get(id);
  }

  ensureUser(id, { pushName = null, isBot = false } = {}) {
    if (!id) throw new Error('Economy user ID wajib diisi.');
    return this.repositories.users.upsert({ jid: id, pushName, isBot }).user;
  }

  getWallet(id, options = {}) {
    const user = this.ensureUser(id, options);
    return Object.freeze({
      id: user.jid,
      number: user.number ?? null,
      coins: Math.max(0, Number(user.coins) || 0),
      isPremium: Boolean(user.is_premium),
      premiumUntil: user.premium_until == null ? null : Number(user.premium_until),
      lastClaimAt: Math.max(0, Number(user.last_claim_at) || 0),
    });
  }

  getCoins(id) {
    return this.getWallet(id).coins;
  }

  addCoins(id, amount, reason = 'unknown', options = {}) {
    const user = this.ensureUser(id, options);
    const value = validAmount(amount);
    if (!value) return user.coins;
    const balance = Math.max(0, Number(user.coins) || 0) + value;
    this.repositories.economy.transfer({
      userJid: id,
      type: 'credit',
      amount: value,
      balanceAfter: balance,
      reason,
    });
    return balance;
  }

  spendCoins(id, amount, reason = 'feature', options = {}) {
    const user = this.ensureUser(id, options);
    const value = validAmount(amount);
    const balance = Math.max(0, Number(user.coins) || 0);
    if (balance < value) return { ok: false, balance, required: value };

    const nextBalance = balance - value;
    this.repositories.economy.transfer({
      userJid: id,
      type: 'debit',
      amount: value,
      balanceAfter: nextBalance,
      reason,
    });
    return { ok: true, balance: nextBalance, spent: value };
  }

  canClaim(id, now = Date.now(), options = {}) {
    const user = this.ensureUser(id, options);
    const lastClaim = Math.max(0, Number(user.last_claim_at) || 0);
    const remaining = Math.max(0, CLAIM_COOLDOWN_MS - (now - lastClaim));
    return Object.freeze({
      ok: remaining === 0,
      remaining,
      nextClaimAt: now + remaining,
    });
  }

  claim(id, now = Date.now(), options = {}) {
    const user = this.ensureUser(id, options);
    const status = this.canClaim(id, now, options);
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
    this.repositories.economy.transactions({
      userJid: id,
      type: 'credit',
      amount,
      balanceAfter: nextBalance,
      reason: 'claim',
      at: now,
    });
    return { ok: true, amount, balance: nextBalance, nextClaimAt: now + CLAIM_COOLDOWN_MS };
  }

  history(id, limit = 20) {
    this.ensureUser(id);
    return this.repositories.economy.history(id, limit);
  }
}

export const economyDefaults = Object.freeze({
  newUserCoins: DEFAULT_NEW_USER_COINS,
  claimCooldownMs: CLAIM_COOLDOWN_MS,
  claimReward: [MIN_CLAIM_COINS, MAX_CLAIM_COINS],
});
