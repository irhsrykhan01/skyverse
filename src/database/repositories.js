import { normalizePhoneNumber } from '../security/identity.js';

export function createRepositories(database) {
  function upsertUser({ jid, pushName = null, isBot = false }) {
    if (!jid) return { created: false, user: undefined };
    const existing = getUser(jid);
    const now = Date.now();
    const number = normalizePhoneNumber(String(jid).split('@')[0]);

    if (existing) {
      database.exec(
        `UPDATE users SET number = ?, push_name = ?, is_bot = ?, updated_at = ? WHERE jid = ?`,
        [number, pushName, isBot ? 1 : 0, now, jid],
      );
      return { created: false, user: getUser(jid) };
    }

    database.exec(
      `INSERT INTO users (jid, number, push_name, is_bot, created_at, updated_at, coins)
       VALUES (?, ?, ?, ?, ?, ?, 100)`,
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
       ON CONFLICT(jid) DO UPDATE SET subject = excluded.subject, updated_at = excluded.updated_at`,
      [jid, subject, now, now],
    );
  }

  function incrementCommand(command, userJid = null) {
    const now = Date.now();
    database.exec(
      `INSERT INTO command_stats (command, usage_count, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(command) DO UPDATE SET usage_count = usage_count + 1, updated_at = excluded.updated_at`,
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
       ON CONFLICT(scope, scope_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [scope, scopeId, key, String(value), Date.now()],
    );
  }

  function stats() {
    return database.all('SELECT command, usage_count FROM command_stats ORDER BY usage_count DESC');
  }

  function userStats(limit = 20) {
    return database.all(
      `SELECT user_jid, SUM(usage_count) AS usage_count
       FROM user_command_stats GROUP BY user_jid
       ORDER BY usage_count DESC LIMIT ?`,
      [Math.max(1, Math.min(100, Number(limit) || 20))],
    );
  }

  function getUser(jid) {
    return jid ? database.get(
      `SELECT jid, number, push_name, is_bot, created_at, updated_at,
              coins, is_premium, premium_until, last_claim_at
       FROM users WHERE jid = ?`,
      [jid],
    ) : undefined;
  }

  function updateWallet(jid, { coins, isPremium, premiumUntil, lastClaimAt }) {
    const user = getUser(jid);
    if (!user) return undefined;
    database.exec(
      `UPDATE users SET coins = ?, is_premium = ?, premium_until = ?, last_claim_at = ?, updated_at = ? WHERE jid = ?`,
      [
        Math.max(0, Math.floor(Number(coins) || 0)),
        isPremium ? 1 : 0,
        premiumUntil == null ? null : Number(premiumUntil),
        Math.max(0, Math.floor(Number(lastClaimAt) || 0)),
        Date.now(),
        jid,
      ],
    );
    return getUser(jid);
  }

  function logEconomyTransaction({ userJid, type, amount, balanceAfter, reason = null, at = Date.now() }) {
    database.exec(
      `INSERT INTO economy_transactions (user_jid, type, amount, balance_after, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userJid, type, Math.floor(Number(amount) || 0), Math.max(0, Math.floor(Number(balanceAfter) || 0)), reason, at],
    );
  }

  function economyTransactions(userJid, limit = 50) {
    return database.all(
      `SELECT type, amount, balance_after, reason, created_at
       FROM economy_transactions WHERE user_jid = ?
       ORDER BY id DESC LIMIT ?`,
      [userJid, Math.max(1, Math.min(200, Number(limit) || 50))],
    );
  }

  return Object.freeze({
    users: Object.freeze({ upsert: upsertUser, get: getUser, updateWallet }),
    groups: Object.freeze({ upsert: upsertGroup }),
    commands: Object.freeze({ increment: incrementCommand, stats, userStats }),
    economy: Object.freeze({ transactions: logEconomyTransaction, history: economyTransactions }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
