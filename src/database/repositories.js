import { normalizePhoneNumber } from '../security/identity.js';

export function createRepositories(database) {
  function upsertUser({ jid, pushName = null, isBot = false }) {
    if (!jid) return;
    const now = Date.now();
    const number = normalizePhoneNumber(String(jid).split('@')[0]);
    database.exec(
      `INSERT INTO users (jid, number, push_name, is_bot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(jid) DO UPDATE SET
         number = excluded.number,
         push_name = excluded.push_name,
         is_bot = excluded.is_bot,
         updated_at = excluded.updated_at`,
      [jid, number, pushName, isBot ? 1 : 0, now, now],
    );
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

  function incrementCommand(command) {
    const now = Date.now();
    database.exec(
      `INSERT INTO command_stats (command, usage_count, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(command) DO UPDATE SET usage_count = usage_count + 1, updated_at = excluded.updated_at`,
      [command, now],
    );
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

  return Object.freeze({
    users: Object.freeze({ upsert: upsertUser }),
    groups: Object.freeze({ upsert: upsertGroup }),
    commands: Object.freeze({ increment: incrementCommand, stats }),
    settings: Object.freeze({ get: getSetting, set: setSetting }),
  });
}
