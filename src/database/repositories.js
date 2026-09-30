import { economyConfig } from '../economy/config.js';
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

function clampBalance(value) {
  return Math.max(0, Math.min(economyConfig.limits.maxBalance, safeInteger(value)));
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
       (jid, number, push_name, is_bot, created_at, updated_at, coins)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jid, number, pushName, isBot ? 1 : 0, now, now, economyConfig.startingCoins],
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
              coins, is_premium, premium_until, last_claim_at,
              daily_streak, last_daily_at
       FROM users WHERE jid = ?`,
      [jid],
    ) : undefined;
  }

  function updateWallet(jid, { coins, isPremium, premiumUntil, lastClaimAt, dailyStreak, lastDailyAt }) {
    const user = getUser(jid);
    if (!user) return undefined;
    database.exec(
      `UPDATE users
       SET coins = ?, is_premium = ?, premium_until = ?,
           last_claim_at = ?, daily_streak = ?, last_daily_at = ?, updated_at = ?
       WHERE jid = ?`,
      [
        clampBalance(coins),
        isPremium ? 1 : 0,
        premiumUntil == null ? null : safeInteger(premiumUntil),
        Math.max(0, safeInteger(lastClaimAt)),
        Math.max(0, safeInteger(dailyStreak)),
        Math.max(0, safeInteger(lastDailyAt)),
        Date.now(),
        jid,
      ],
    );
    return getUser(jid);
  }

  function insertEconomyTransaction({
    userJid,
    type,
    amount,
    balanceAfter,
    counterpartyJid = null,
    reason = null,
    at = Date.now(),
  }) {
    database.exec(
      `INSERT INTO economy_transactions
       (user_jid, type, amount, balance_after, counterparty_jid, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userJid,
        type,
        Math.max(0, safeInteger(amount)),
        clampBalance(balanceAfter),
        counterpartyJid,
        reason,
        at,
      ],
    );
  }

  function creditEconomy({ userJid, amount, reason = 'credit', at = Date.now() }) {
    const value = Math.max(0, safeInteger(amount));
    if (!value) {
      return {
        ok: false,
        balance: clampBalance(getUser(userJid)?.coins),
        added: 0,
        reason: 'invalid_amount',
      };
    }

    let result = null;
    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);

      const current = clampBalance(user.coins);
      const nextBalance = current + value;
      if (nextBalance > economyConfig.limits.maxBalance) {
        result = { ok: false, balance: current, added: 0, reason: 'balance_limit' };
        return;
      }

      database.exec(
        'UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?',
        [nextBalance, at, userJid],
      );
      insertEconomyTransaction({
        userJid,
        type: 'credit',
        amount: value,
        balanceAfter: nextBalance,
        reason,
        at,
      });
      result = { ok: true, balance: nextBalance, added: value };
    });

    return result;
  }

  function debitEconomy({ userJid, amount, reason = 'debit', at = Date.now() }) {
    const value = Math.max(0, safeInteger(amount));
    let result = null;

    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);

      const balance = clampBalance(user.coins);
      if (!value) {
        result = { ok: false, balance, spent: 0, required: 0, reason: 'invalid_amount' };
        return;
      }
      if (balance < value) {
        result = { ok: false, balance, spent: 0, required: value, reason: 'insufficient_funds' };
        return;
      }

      const nextBalance = balance - value;
      database.exec(
        'UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?',
        [nextBalance, at, userJid],
      );
      insertEconomyTransaction({
        userJid,
        type: 'debit',
        amount: value,
        balanceAfter: nextBalance,
        reason,
        at,
      });
      result = { ok: true, balance: nextBalance, spent: value, required: value };
    });

    return result;
  }

  function claimEconomy({ userJid, amount, now, cooldownMs, reason = 'claim' }) {
    const value = Math.max(0, safeInteger(amount));
    let result = null;

    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);

      const lastClaimAt = Math.max(0, safeInteger(user.last_claim_at));
      const remaining = Math.max(0, cooldownMs - (now - lastClaimAt));
      const balance = clampBalance(user.coins);

      if (remaining > 0) {
        result = { ok: false, remaining, balance };
        return;
      }

      if (!value || balance + value > economyConfig.limits.maxBalance) {
        result = { ok: false, remaining: 0, balance, reason: 'balance_limit' };
        return;
      }

      const nextBalance = balance + value;
      database.exec(
        'UPDATE users SET coins = ?, last_claim_at = ?, updated_at = ? WHERE jid = ?',
        [nextBalance, now, now, userJid],
      );
      insertEconomyTransaction({
        userJid,
        type: 'credit',
        amount: value,
        balanceAfter: nextBalance,
        reason,
        at: now,
      });
      result = { ok: true, amount: value, balance: nextBalance, nextClaimAt: now + cooldownMs };
    });

    return result;
  }

  function dailyEconomy({
    userJid,
    now,
    cooldownMs,
    streakWindowMs,
    baseReward,
    streakBonus,
    maxReward,
    reason = 'daily',
  }) {
    let result = null;

    database.transaction(() => {
      const user = getUser(userJid);
      if (!user) throw new Error(`Economy user not found: ${userJid}`);

      const lastDailyAt = Math.max(0, safeInteger(user.last_daily_at));
      const previousStreak = Math.max(0, safeInteger(user.daily_streak));
      const remaining = Math.max(0, cooldownMs - (now - lastDailyAt));
      const balance = clampBalance(user.coins);

      if (remaining > 0) {
        result = {
          ok: false,
          remaining,
          balance,
          streak: previousStreak,
        };
        return;
      }

      const streak = lastDailyAt > 0 && now - lastDailyAt <= streakWindowMs
        ? previousStreak + 1
        : 1;
      const amount = Math.min(
        maxReward,
        Math.max(0, safeInteger(baseReward)) + Math.max(0, streak - 1) * Math.max(0, safeInteger(streakBonus)),
      );

      if (!amount || balance + amount > economyConfig.limits.maxBalance) {
        result = { ok: false, remaining: 0, balance, streak, reason: 'balance_limit' };
        return;
      }

      const nextBalance = balance + amount;
      database.exec(
        `UPDATE users
         SET coins = ?, daily_streak = ?, last_daily_at = ?, updated_at = ?
         WHERE jid = ?`,
        [nextBalance, streak, now, now, userJid],
      );
      insertEconomyTransaction({
        userJid,
        type: 'credit',
        amount,
        balanceAfter: nextBalance,
        reason,
        at: now,
      });
      result = {
        ok: true,
        amount,
        balance: nextBalance,
        streak,
        nextDailyAt: now + cooldownMs,
      };
    });

    return result;
  }

  function transferEconomy({
    fromUserJid,
    toUserJid,
    amount,
    fee = 0,
    reason = 'transfer',
    at = Date.now(),
  }) {
    const value = Math.max(0, safeInteger(amount));
    const transferFee = Math.max(0, safeInteger(fee));
    let result = null;

    database.transaction(() => {
      const sender = getUser(fromUserJid);
      const recipient = getUser(toUserJid);
      if (!sender) throw new Error(`Economy user not found: ${fromUserJid}`);
      if (!recipient) throw new Error(`Economy user not found: ${toUserJid}`);

      const senderBalance = clampBalance(sender.coins);
      const recipientBalance = clampBalance(recipient.coins);
      const totalDebit = value + transferFee;

      if (!value) {
        result = { ok: false, reason: 'invalid_amount', balance: senderBalance };
        return;
      }
      if (senderBalance < totalDebit) {
        result = { ok: false, reason: 'insufficient_funds', balance: senderBalance, required: totalDebit };
        return;
      }
      if (recipientBalance + value > economyConfig.limits.maxBalance) {
        result = { ok: false, reason: 'recipient_limit', balance: senderBalance };
        return;
      }

      const nextSenderBalance = senderBalance - totalDebit;
      const nextRecipientBalance = recipientBalance + value;

      database.exec(
        'UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?',
        [nextSenderBalance, at, fromUserJid],
      );
      database.exec(
        'UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?',
        [nextRecipientBalance, at, toUserJid],
      );

      insertEconomyTransaction({
        userJid: fromUserJid,
        type: 'transfer_out',
        amount: value,
        balanceAfter: nextSenderBalance,
        counterpartyJid: toUserJid,
        reason,
        at,
      });

      if (transferFee > 0) {
        insertEconomyTransaction({
          userJid: fromUserJid,
          type: 'fee',
          amount: transferFee,
          balanceAfter: nextSenderBalance,
          reason: `${reason}:fee`,
          at,
        });
      }

      insertEconomyTransaction({
        userJid: toUserJid,
        type: 'transfer_in',
        amount: value,
        balanceAfter: nextRecipientBalance,
        counterpartyJid: fromUserJid,
        reason,
        at,
      });

      result = {
        ok: true,
        amount: value,
        fee: transferFee,
        senderBalance: nextSenderBalance,
        recipientBalance: nextRecipientBalance,
      };
    });

    return result;
  }

  function economyTransactions(userJid, limit = economyConfig.limits.historyLimit) {
    return database.all(
      `SELECT type, amount, balance_after, counterparty_jid, reason, created_at
       FROM economy_transactions
       WHERE user_jid = ?
       ORDER BY id DESC
       LIMIT ?`,
      [userJid, Math.max(1, Math.min(200, safeInteger(limit, economyConfig.limits.historyLimit)))],
    );
  }

  function economyLeaderboard(limit = economyConfig.limits.leaderboardLimit) {
    return database.all(
      `SELECT jid, number, push_name, coins
       FROM users
       WHERE is_bot = 0
       ORDER BY coins DESC, updated_at ASC
       LIMIT ?`,
      [Math.max(1, Math.min(100, safeInteger(limit, economyConfig.limits.leaderboardLimit)))],
    );
  }

  function logEconomyTransaction({
    userJid,
    type,
    amount,
    balanceAfter,
    counterpartyJid = null,
    reason = null,
    at = Date.now(),
  }) {
    insertEconomyTransaction({
      userJid,
      type,
      amount,
      balanceAfter,
      counterpartyJid,
      reason,
      at,
    });
  }

  function transferLegacy({ userJid, type, amount, balanceAfter, reason = null, at = Date.now() }) {
    const nextBalance = clampBalance(balanceAfter);
    database.transaction(() => {
      const result = getUser(userJid);
      if (!result) throw new Error(`Economy user not found: ${userJid}`);
      database.exec(
        'UPDATE users SET coins = ?, updated_at = ? WHERE jid = ?',
        [nextBalance, at, userJid],
      );
      insertEconomyTransaction({
        userJid,
        type,
        amount,
        balanceAfter: nextBalance,
        reason,
        at,
      });
    });
    return getUser(userJid);
  }

  return Object.freeze({
    users: Object.freeze({ upsert: upsertUser, get: getUser, updateWallet }),
    groups: Object.freeze({ upsert: upsertGroup }),
    commands: Object.freeze({ increment: incrementCommand, stats, userStats }),
    economy: Object.freeze({
      transactions: logEconomyTransaction,
      transfer: transferLegacy,
      transferBetween: transferEconomy,
      credit: creditEconomy,
      debit: debitEconomy,
      claim: claimEconomy,
      daily: dailyEconomy,
      history: economyTransactions,
      leaderboard: economyLeaderboard,
    }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
