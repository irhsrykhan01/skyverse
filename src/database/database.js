import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { economyConfig } from '../economy/config.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = join(MODULE_DIR, '../../node_modules/sql.js/dist');

export async function createDatabase(databasePath, logger) {
  const SQL = await initSqlJs({ locateFile: (file) => join(WASM_DIR, file) });
  await mkdir(dirname(databasePath), { recursive: true });
  let database;
  try { database = new SQL.Database(await readFile(databasePath)); logger.info('SQLite database loaded', { path: databasePath }); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; database = new SQL.Database(); logger.info('SQLite database created', { path: databasePath }); }

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      jid TEXT PRIMARY KEY, number TEXT, push_name TEXT, is_bot INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      coins INTEGER NOT NULL DEFAULT ${economyConfig.startingCoins}, is_premium INTEGER NOT NULL DEFAULT 0,
      premium_until INTEGER, last_claim_at INTEGER NOT NULL DEFAULT 0, daily_streak INTEGER NOT NULL DEFAULT 0,
      last_daily_at INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0, bio TEXT,
      last_active_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS groups (jid TEXT PRIMARY KEY, subject TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (scope TEXT NOT NULL, scope_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, scope_id, key));
    CREATE TABLE IF NOT EXISTS command_stats (command TEXT PRIMARY KEY, usage_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_command_stats (user_jid TEXT NOT NULL, command TEXT NOT NULL, usage_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (user_jid, command));
    CREATE TABLE IF NOT EXISTS economy_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, counterparty_jid TEXT, reason TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS xp_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_jid TEXT NOT NULL, amount INTEGER NOT NULL, xp_after INTEGER NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_achievements (user_jid TEXT NOT NULL, achievement_id TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (user_jid, achievement_id));
    CREATE TABLE IF NOT EXISTS quest_progress (user_jid TEXT NOT NULL, quest_id TEXT NOT NULL, period_key TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, completed_at INTEGER, claimed_at INTEGER, PRIMARY KEY (user_jid, quest_id, period_key));
    CREATE INDEX IF NOT EXISTS idx_economy_transactions_user_id ON economy_transactions (user_jid, id DESC);
    CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions (user_jid, id DESC);
    CREATE INDEX IF NOT EXISTS idx_users_coins ON users (coins DESC);
    CREATE INDEX IF NOT EXISTS idx_users_xp ON users (xp DESC);
    CREATE INDEX IF NOT EXISTS idx_quest_progress_user_period ON quest_progress (user_jid, period_key);
  `);

  const migrationStatement = database.prepare('PRAGMA table_info(users)');
  const userColumns = [];
  try { while (migrationStatement.step()) userColumns.push(migrationStatement.getAsObject().name); } finally { migrationStatement.free(); }
  const transactionMigrationStatement = database.prepare('PRAGMA table_info(economy_transactions)');
  const transactionColumns = [];
  try { while (transactionMigrationStatement.step()) transactionColumns.push(transactionMigrationStatement.getAsObject().name); } finally { transactionMigrationStatement.free(); }
  const migrations = [
    ['coins', `ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT ${economyConfig.startingCoins}`],
    ['is_premium', 'ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0'],
    ['premium_until', 'ALTER TABLE users ADD COLUMN premium_until INTEGER'],
    ['last_claim_at', 'ALTER TABLE users ADD COLUMN last_claim_at INTEGER NOT NULL DEFAULT 0'],
    ['daily_streak', 'ALTER TABLE users ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0'],
    ['last_daily_at', 'ALTER TABLE users ADD COLUMN last_daily_at INTEGER NOT NULL DEFAULT 0'],
    ['xp', 'ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0'],
    ['bio', 'ALTER TABLE users ADD COLUMN bio TEXT'],
    ['last_active_at', 'ALTER TABLE users ADD COLUMN last_active_at INTEGER NOT NULL DEFAULT 0'],
  ];
  let migrated = false;
  for (const [name, sql] of migrations) { if (!userColumns.includes(name)) { database.exec(sql); migrated = true; } }
  if (!transactionColumns.includes('counterparty_jid')) { database.exec('ALTER TABLE economy_transactions ADD COLUMN counterparty_jid TEXT'); migrated = true; }

  let dirty = true, dirtyVersion = 1, closed = false, flushPromise = null;
  async function persist() {
    if (closed || !dirty) return;
    if (flushPromise) return flushPromise;
    const writeVersion = dirtyVersion, exported = Buffer.from(database.export());
    flushPromise = (async () => { await writeFile(databasePath, exported); if (dirtyVersion === writeVersion) dirty = false; })().finally(() => { flushPromise = null; });
    return flushPromise;
  }
  const flushTimer = setInterval(() => { persist().catch((error) => logger.error('Database auto-save failed', { error: error?.message ?? String(error) })); }, 10_000);
  flushTimer.unref?.();
  function markDirty() { dirty = true; dirtyVersion += 1; }
  function transaction(callback) { database.exec('BEGIN IMMEDIATE'); try { const result = callback(); database.exec('COMMIT'); markDirty(); return result; } catch (error) { try { database.exec('ROLLBACK'); } catch {} throw error; } }
  function exec(sql, params = []) { const statement = database.prepare(sql); try { statement.bind(params); while (statement.step()) statement.getAsObject(); } finally { statement.free(); } markDirty(); }
  function get(sql, params = []) { const statement = database.prepare(sql); try { statement.bind(params); return statement.step() ? statement.getAsObject() : undefined; } finally { statement.free(); } }
  function all(sql, params = []) { const statement = database.prepare(sql), rows = []; try { statement.bind(params); while (statement.step()) rows.push(statement.getAsObject()); return rows; } finally { statement.free(); } }
  async function close() { if (closed) return; clearInterval(flushTimer); do { await persist(); } while (dirty); database.close(); closed = true; }
  if (migrated) logger.info('SQLite schema migrated.');
  return Object.freeze({ exec, transaction, get, all, persist, close, markDirty, get path() { return databasePath; } });
}
