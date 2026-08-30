import { normalizePhoneNumber } from '../security/identity.js';

function phoneFromJid(phoneJid) {
  if (!phoneJid) return null;
  const raw = String(phoneJid).trim();
  if (raw.includes('@lid') || raw.includes('@hosted.lid')) return null;
  const digits = normalizePhoneNumber(raw.split('@')[0]);
  return digits || null;
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
        `UPDATE users SET number = ?, push_name = ?, is_bot = ?, updated_at = ? WHERE jid = ?`,
        [number, pushName ?? existing.push_name ?? null, isBot ? 1 : 0, now, jid],
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

  function transferEconomy({ userJid, type, amount, balanceAfter, reason = null, at = Date.now() }) {
    const nextBalance = Math.max(0, Math.floor(Number(balanceAfter) || 0));
    database.transaction(() => {
      const result = database.get('SELECT jid FROM users WHERE jid = ?', [userJid]);
      if (!result) throw new Error(`Economy user not found: ${userJid}`);
      database.exec('UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?', [nextBalance, at, userJid]);
      database.exec(
        `INSERT INTO economy_transactions (user_jid, type, amount, balance_after, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userJid, type, Math.floor(Number(amount) || 0), nextBalance, reason, at],
      );
    });
    return getUser(userJid);
  }

  function creditEconomy({ userJid, amount, reason = 'credit', at = Date.now() }) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value) return { ok: false, balance: Math.max(0, Number(getUser(userJid)?.coins) || 0) };
    let balance = 0;
    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);
      balance = Math.max(0, Number(user.coins) || 0) + value;
      database.exec('UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?', [balance, at, userJid]);
      database.exec(
        `INSERT INTO economy_transactions (user_jid, type, amount, balance_after, reason, created_at)
         VALUES (?, 'credit', ?, ?, ?, ?)`,
        [userJid, value, balance, reason, at],
      );
    });
    return { ok: true, balance, added: value };
  }

  function debitEconomy({ userJid, amount, reason = 'debit', at = Date.now() }) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    let balance = 0;
    let ok = false;
    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);
      balance = Math.max(0, Number(user.coins) || 0);
      if (balance < value) return;
      balance -= value;
      database.exec('UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?', [balance, at, userJid]);
      database.exec(
        `INSERT INTO economy_transactions (user_jid, type, amount, balance_after, reason, created_at)
         VALUES (?, 'debit', ?, ?, ?, ?)`,
        [userJid, value, balance, reason, at],
      );
      ok = true;
    });
    return { ok, balance, spent: ok ? value : 0, required: value };
  }

  function claimEconomy({ userJid, amount, now, cooldownMs, reason = 'claim' }) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    let result = null;
    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);
      const lastClaimAt = Math.max(0, Number(user.last_claim_at) || 0);
      const remaining = Math.max(0, cooldownMs - (now - lastClaimAt));
      if (remaining > 0) {
        result = { ok: false, remaining, balance: Math.max(0, Number(user.coins) || 0) };
        return;
      }
      const balance = Math.max(0, Number(user.coins) || 0) + value;
      database.exec('UPDATE users SET coins = ?, last_claim_at = ?, updated_at = ? WHERE jid = ?', [balance, now, now, userJid]);
      database.exec(
        `INSERT INTO economy_transactions (user_jid, type, amount, balance_after, reason, created_at)
         VALUES (?, 'credit', ?, ?, ?, ?)`,
        [userJid, value, balance, reason, now],
      );
      result = { ok: true, amount: value, balance, nextClaimAt: now + cooldownMs };
    });
    return result;
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
    economy: Object.freeze({
      transactions: logEconomyTransaction,
      transfer: transferEconomy,
      credit: creditEconomy,
      debit: debitEconomy,
      claim: claimEconomy,
      history: economyTransactions,
    }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
