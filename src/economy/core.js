import { currencyLabel, economyConfig, formatCoins } from './config.js';

function validAmount(amount, { allowZero = false } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  if (value < (allowZero ? 0 : economyConfig.limits.minTransaction)) return null;
  if (value > economyConfig.limits.maxBalance) return null;
  return value;
}

function remaining(now, lastAt, cooldownMs) {
  return Math.max(0, cooldownMs - (now - Math.max(0, Number(lastAt) || 0)));
}

export class EconomyCore {
  constructor({ repositories, logger = null } = {}) {
    if (!repositories?.users || !repositories?.economy) {
      throw new Error('EconomyCore membutuhkan repositories.users dan repositories.economy.');
    }
    this.repositories = repositories;
    this.logger = logger;
  }

  get config() {
    return economyConfig;
  }

  get currency() {
    return economyConfig.currency;
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
      dailyStreak: Math.max(0, Number(user.daily_streak) || 0),
      lastDailyAt: Math.max(0, Number(user.last_daily_at) || 0),
    });
  }

  getCoins(id) {
    return this.getWallet(id).coins;
  }

  format(amount) {
    return formatCoins(amount);
  }

  label(amount) {
    return currencyLabel(amount);
  }

  addCoins(id, amount, reason = 'unknown', options = {}) {
    this.ensureUser(id, options);
    const value = validAmount(amount);
    if (value === null) return this.getCoins(id);

    const result = this.repositories.economy.credit({
      userJid: id,
      amount: value,
      reason,
    });
    return result.balance;
  }

  spendCoins(id, amount, reason = 'feature', options = {}) {
    this.ensureUser(id, options);
    const value = validAmount(amount);

    if (value === null) {
      return {
        ok: false,
        balance: this.getCoins(id),
        spent: 0,
        required: Math.max(0, Math.floor(Number(amount) || 0)),
        reason: 'invalid_amount',
      };
    }

    return this.repositories.economy.debit({
      userJid: id,
      amount: value,
      reason,
    });
  }

  canClaim(id, now = Date.now(), options = {}) {
    const user = this.ensureUser(id, options);
    const remainingMs = remaining(now, user.last_claim_at, economyConfig.claim.cooldownMs);

    return Object.freeze({
      ok: remainingMs === 0,
      remaining: remainingMs,
      nextClaimAt: now + remainingMs,
    });
  }

  claim(id, now = Date.now(), options = {}) {
    this.ensureUser(id, options);

    const amount = Math.floor(
      Math.random() * (economyConfig.claim.maxReward - economyConfig.claim.minReward + 1),
    ) + economyConfig.claim.minReward;

    return this.repositories.economy.claim({
      userJid: id,
      amount,
      now,
      cooldownMs: economyConfig.claim.cooldownMs,
      reason: 'claim',
    });
  }

  canDaily(id, now = Date.now(), options = {}) {
    const user = this.ensureUser(id, options);
    const remainingMs = remaining(now, user.last_daily_at, economyConfig.daily.cooldownMs);

    return Object.freeze({
      ok: remainingMs === 0,
      remaining: remainingMs,
      nextDailyAt: now + remainingMs,
      streak: Math.max(0, Number(user.daily_streak) || 0),
    });
  }

  daily(id, now = Date.now(), options = {}) {
    this.ensureUser(id, options);

    return this.repositories.economy.daily({
      userJid: id,
      now,
      cooldownMs: economyConfig.daily.cooldownMs,
      streakWindowMs: economyConfig.daily.streakWindowMs,
      baseReward: economyConfig.daily.baseReward,
      streakBonus: economyConfig.daily.streakBonus,
      maxReward: economyConfig.daily.maxReward,
      reason: 'daily',
    });
  }

  transfer(fromId, toId, amount, reason = 'transfer') {
    if (!fromId || !toId) throw new Error('Pengirim dan penerima Coin wajib diisi.');

    this.ensureUser(fromId);
    this.ensureUser(toId);

    if (fromId === toId) {
      return {
        ok: false,
        reason: 'self_transfer',
        balance: this.getCoins(fromId),
      };
    }

    const value = validAmount(amount);
    if (value === null) {
      return {
        ok: false,
        reason: 'invalid_amount',
        balance: this.getCoins(fromId),
        required: Math.max(0, Math.floor(Number(amount) || 0)),
      };
    }

    return this.repositories.economy.transferBetween({
      fromUserJid: fromId,
      toUserJid: toId,
      amount: value,
      fee: economyConfig.transfer.fee,
      reason,
    });
  }

  history(id, limit = economyConfig.limits.historyLimit) {
    this.ensureUser(id);

    const safeLimit = Math.max(
      1,
      Math.min(
        economyConfig.limits.historyLimit,
        Number(limit) || economyConfig.limits.historyLimit,
      ),
    );

    return this.repositories.economy.history(id, safeLimit);
  }

  leaderboard(limit = economyConfig.limits.leaderboardLimit) {
    const safeLimit = Math.max(
      1,
      Math.min(100, Number(limit) || economyConfig.limits.leaderboardLimit),
    );

    return this.repositories.economy.leaderboard(safeLimit);
  }
}

export const economyDefaults = Object.freeze({
  newUserCoins: economyConfig.startingCoins,
  claimCooldownMs: economyConfig.claim.cooldownMs,
  claimReward: [economyConfig.claim.minReward, economyConfig.claim.maxReward],
  dailyCooldownMs: economyConfig.daily.cooldownMs,
  dailyReward: [economyConfig.daily.baseReward, economyConfig.daily.maxReward],
});
