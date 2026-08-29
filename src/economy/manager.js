const DEFAULT_NEW_USER_COINS = 100;
const MIN_CLAIM_COINS = 2;
const MAX_CLAIM_COINS = 7;
const CLAIM_COOLDOWN_MS = 3 * 60 * 60 * 1000;

export class EconomyManager {
  constructor({ store }) {
    this.store = store;
  }

  getUser(id) {
    return this.store.getUser(id);
  }

  ensureUser(id) {
    const existing = this.getUser(id);
    if (existing) return existing;

    const user = {
      id,
      coins: DEFAULT_NEW_USER_COINS,
      isPremium: false,
      premiumUntil: null,
      claim: { lastClaim: 0 },
      createdAt: Date.now(),
    };

    this.store.setUser(id, user);
    return user;
  }

  getCoins(id) {
    return this.ensureUser(id).coins;
  }

  addCoins(id, amount, reason = 'unknown') {
    const user = this.ensureUser(id);
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    user.coins += value;
    this.store.setUser(id, user);
    this.store.logTransaction?.({ id, type: 'credit', amount: value, reason, at: Date.now() });
    return user.coins;
  }

  spendCoins(id, amount, reason = 'feature') {
    const user = this.ensureUser(id);
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (user.coins < value) return { ok: false, balance: user.coins, required: value };

    user.coins -= value;
    this.store.setUser(id, user);
    this.store.logTransaction?.({ id, type: 'debit', amount: value, reason, at: Date.now() });
    return { ok: true, balance: user.coins, spent: value };
  }

  canClaim(id, now = Date.now()) {
    const user = this.ensureUser(id);
    const lastClaim = Number(user.claim?.lastClaim || 0);
    const remaining = Math.max(0, CLAIM_COOLDOWN_MS - (now - lastClaim));
    return { ok: remaining === 0, remaining };
  }

  claim(id, now = Date.now()) {
    const user = this.ensureUser(id);
    const status = this.canClaim(id, now);
    if (!status.ok) return { ok: false, remaining: status.remaining, balance: user.coins };

    const amount = Math.floor(Math.random() * (MAX_CLAIM_COINS - MIN_CLAIM_COINS + 1)) + MIN_CLAIM_COINS;
    user.claim = { lastClaim: now };
    user.coins += amount;
    this.store.setUser(id, user);
    this.store.logTransaction?.({ id, type: 'credit', amount, reason: 'claim', at: now });
    return { ok: true, amount, balance: user.coins, nextClaimAt: now + CLAIM_COOLDOWN_MS };
  }
}

export const economyDefaults = Object.freeze({
  newUserCoins: DEFAULT_NEW_USER_COINS,
  claimCooldownMs: CLAIM_COOLDOWN_MS,
  claimReward: [MIN_CLAIM_COINS, MAX_CLAIM_COINS],
});
