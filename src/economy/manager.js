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
    this.ensureUser(id, options);
    const value = validAmount(amount);
    if (!value) return this.getCoins(id);
    return this.repositories.economy.credit({ userJid: id, amount: value, reason }).balance;
  }

  spendCoins(id, amount, reason = 'feature', options = {}) {
    this.ensureUser(id, options);
    const value = validAmount(amount);
    return this.repositories.economy.debit({ userJid: id, amount: value, reason });
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
    this.ensureUser(id, options);
    const amount = Math.floor(Math.random() * (MAX_CLAIM_COINS - MIN_CLAIM_COINS + 1)) + MIN_CLAIM_COINS;
    return this.repositories.economy.claim({
      userJid: id,
      amount,
      now,
      cooldownMs: CLAIM_COOLDOWN_MS,
      reason: 'claim',
    });
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
