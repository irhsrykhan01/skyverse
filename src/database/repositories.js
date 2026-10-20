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
              is_premium, premium_until
       FROM users WHERE jid = ?`,
      [jid],
    ) : undefined;
  }

  function findUserByNumber(number) {
    const normalized = phoneFromJid(number);
    if (!normalized) return undefined;
    return database.get(
      `SELECT jid, number, push_name, is_bot, created_at, updated_at,
              is_premium, premium_until
       FROM users WHERE number = ? LIMIT 1`,
      [normalized],
    );
  }

  return Object.freeze({
    users: Object.freeze({ upsert: upsertUser, get: getUser, findByNumber: findUserByNumber }),
    groups: Object.freeze({ upsert: upsertGroup }),
    commands: Object.freeze({ increment: incrementCommand, stats, userStats }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
