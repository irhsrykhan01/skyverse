const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const economyConfig = Object.freeze({
  currency: Object.freeze({
    code: 'SKY',
    name: 'Coin',
    plural: 'Coins',
    symbol: '🪙',
  }),
  startingCoins: 100,
  limits: Object.freeze({
    minTransaction: 1,
    maxBalance: 9_000_000_000_000_000,
    historyLimit: 20,
    leaderboardLimit: 10,
  }),
  claim: Object.freeze({
    cooldownMs: 3 * HOUR_MS,
    minReward: 2,
    maxReward: 7,
  }),
  daily: Object.freeze({
    cooldownMs: DAY_MS,
    streakWindowMs: 2 * DAY_MS,
    baseReward: 50,
    streakBonus: 10,
    maxReward: 100,
  }),
  transfer: Object.freeze({
    fee: 0,
  }),
});

export function formatCoins(amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  return new Intl.NumberFormat('id-ID').format(value);
}

export function currencyLabel(amount) {
  return `${formatCoins(amount)} ${economyConfig.currency.symbol}`;
}
