import { normalizePhoneNumber } from '../security/identity.js';

function phoneFromJid(phoneJid) {
  if (!phoneJid) return null;
  const raw = String(phoneJid).trim();
  if (raw.includes('@lid') || raw.includes('@hosted.lid')) return null;
  const base = raw.split('@')[0].split(':')[0];
  const digits = normalizePhoneNumber(base);
  return digits || null;
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) ? number : fallback;
}

export function createRepositories(database) {
  function upsertUser({ jid, phoneJid = null, pushName = null, isBot = false }) {
    if (!jid) return { created: false, user: undefined };
    const existing = getUser(jid);
    const now = Date.now();
    const incomingNumber = phoneFromJid(phoneJid);
    const number = incomingNumber ?? existing?.number ?? null;

    if (existing) {
      database.exec(
        `UPDATE users
         SET number = ?, push_name = ?, is_bot = ?, updated_at = ?
         WHERE jid = ?`,
        [number, pushName ?? existing.push_name ?? null, isBot ? 1 : 0, now, jid],
      );
      return { created: false, user: getUser(jid) };
    }

    database.exec(
      `INSERT INTO users
       (jid, number, push_name, is_bot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jid, number, pushName, isBot ? 1 : 0, now, now],
    );
    return { created: true, user: getUser(jid) };
  }

  function upsertGroup({ jid, subject = null }) {
    if (!jid) return;
    const now = Date.now();
    database.exec(
      `INSERT INTO groups (jid, subject, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(jid) DO UPDATE
       SET subject = excluded.subject, updated_at = excluded.updated_at`,
      [jid, subject, now, now],
    );
  }

  function incrementCommand(command, userJid = null) {
    const now = Date.now();
    database.exec(
      `INSERT INTO command_stats (command, usage_count, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(command) DO UPDATE
       SET usage_count = usage_count + 1, updated_at = excluded.updated_at`,
      [command, now],
    );

    if (userJid) {
      database.exec(
        `INSERT INTO user_command_stats (user_jid, command, usage_count, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(user_jid, command)
         DO UPDATE SET usage_count = usage_count + 1, updated_at = excluded.updated_at`,
        [userJid, command, now],
      );
    }
  }

  function getSetting(scope, scopeId, key, fallback = null) {
    const row = database.get(
      'SELECT value FROM settings WHERE scope = ? AND scope_id = ? AND key = ?',
      [scope, scopeId, key],
    );
    return row?.value ?? fallback;
  }

  function setSetting(scope, scopeId, key, value) {
    database.exec(
      `INSERT INTO settings (scope, scope_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(scope, scope_id, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [scope, scopeId, key, String(value), Date.now()],
    );
  }

  function stats() {
    return database.all('SELECT command, usage_count FROM command_stats ORDER BY usage_count DESC');
  }

  function userStats(limit = 20) {
    return database.all(
      `SELECT user_jid, SUM(usage_count) AS usage_count
       FROM user_command_stats
       GROUP BY user_jid
       ORDER BY usage_count DESC
       LIMIT ?`,
      [Math.max(1, Math.min(100, safeInteger(limit, 20)))],
    );
  }

  function getUser(jid) {
    return jid ? database.get(
      `SELECT jid, number, push_name, is_bot, created_at, updated_at,
              is_premium, premium_until, coins, limits, last_daily_at
       FROM users WHERE jid = ?`,
      [jid],
    ) : undefined;
  }

  function findUserByNumber(number) {
    const normalized = phoneFromJid(number);
    if (!normalized) return undefined;
    return database.get(
      `SELECT jid, number, push_name, is_bot, created_at, updated_at,
              is_premium, premium_until, coins, limits
       FROM users WHERE number = ? LIMIT 1`,
      [normalized],
    );
  }

  function getWallet(jid) {
    const user = getUser(jid);
    return user ? { coins: Number(user.coins) || 0, limits: Number(user.limits) || 0 } : undefined;
  }

  function recordTransaction(jid, currency, amount, balanceAfter, type, metadata = null) {
    database.exec(
      `INSERT INTO economy_transactions
       (user_jid, currency, amount, balance_after, type, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jid, currency, amount, balanceAfter, type, metadata ? JSON.stringify(metadata) : null, Date.now()],
    );
  }

  function creditCoins(jid, amount, type = 'credit', metadata = null) {
    const value = safeInteger(amount, 0);
    if (!jid || value <= 0) return false;
    return database.transaction(() => {
      const user = getUser(jid);
      if (!user) return false;
      const balance = Number(user.coins) + value;
      database.exec('UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?', [balance, Date.now(), jid]);
      recordTransaction(jid, 'coin', value, balance, type, metadata);
      return { coins: balance };
    });
  }

  function spendCoins(jid, amount, type = 'spend', metadata = null) {
    const value = safeInteger(amount, 0);
    if (!jid || value <= 0) return { ok: false, reason: 'invalid_amount' };
    return database.transaction(() => {
      const user = getUser(jid);
      if (!user) return { ok: false, reason: 'user_not_found' };
      if (Number(user.coins) < value) return { ok: false, reason: 'insufficient_funds', coins: Number(user.coins) };
      const balance = Number(user.coins) - value;
      database.exec('UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?', [balance, Date.now(), jid]);
      recordTransaction(jid, 'coin', -value, balance, type, metadata);
      return { ok: true, coins: balance };
    });
  }

  function claimDaily(jid, reward = 200, cooldownMs = 86_400_000) {
    const value = safeInteger(reward, 0);
    const cooldown = safeInteger(cooldownMs, 0);
    if (!jid || value <= 0 || cooldown <= 0) return { ok: false, reason: 'invalid_request' };
    return database.transaction(() => {
      const user = getUser(jid);
      if (!user) return { ok: false, reason: 'user_not_found' };
      const now = Date.now();
      const lastClaim = Number(user.last_daily_at) || 0;
      const nextAt = lastClaim + cooldown;
      if (lastClaim > 0 && now < nextAt) return { ok: false, reason: 'cooldown', nextAt };
      const balance = Number(user.coins) + value;
      database.exec('UPDATE users SET coins = ?, last_daily_at = ?, updated_at = ? WHERE jid = ?', [balance, now, now, jid]);
      recordTransaction(jid, 'coin', value, balance, 'daily', { cooldownMs: cooldown });
      return { ok: true, reward: value, coins: balance, nextAt: now + cooldown };
    });
  }

  function getTransactions(jid, limit = 10) {
    const count = Math.max(1, Math.min(50, safeInteger(limit, 10)));
    return database.all(
      `SELECT currency, amount, balance_after, type, metadata, created_at
       FROM economy_transactions WHERE user_jid = ?
       ORDER BY id DESC LIMIT ?`,
      [jid, count],
    );
  }

  function consumeLimit(jid, amount = 1) {
    const cost = safeInteger(amount, 0);
    if (!jid || cost <= 0) return false;
    return database.transaction(() => {
      const user = getUser(jid);
      if (!user || Number(user.limits) < cost) return false;
      const balance = Number(user.limits) - cost;
      database.exec('UPDATE users SET limits = ?, updated_at = ? WHERE jid = ? AND limits >= ?', [balance, Date.now(), jid, cost]);
      recordTransaction(jid, 'limit', -cost, balance, 'consume');
      return true;
    });
  }

  function refundLimit(jid, amount = 1) {
    const refund = safeInteger(amount, 0);
    if (!jid || refund <= 0) return false;
    return database.transaction(() => {
      const user = getUser(jid);
      if (!user) return false;
      const balance = Number(user.limits) + refund;
      database.exec('UPDATE users SET limits = ?, updated_at = ? WHERE jid = ?', [balance, Date.now(), jid]);
      recordTransaction(jid, 'limit', refund, balance, 'refund');
      return true;
    });
  }

  return Object.freeze({
    users: Object.freeze({ upsert: upsertUser, get: getUser, findByNumber: findUserByNumber }),
    economy: Object.freeze({ get: getWallet, creditCoins, spendCoins, claimDaily, getTransactions, consumeLimit, refundLimit }),
    groups: Object.freeze({ upsert: upsertGroup }),
    commands: Object.freeze({ increment: incrementCommand, stats, userStats }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
