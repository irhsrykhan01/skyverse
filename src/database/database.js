import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = join(MODULE_DIR, '../../node_modules/sql.js/dist');

export async function createDatabase(databasePath, logger) {
  const SQL = await initSqlJs({ locateFile: (file) => join(WASM_DIR, file) });
  await mkdir(dirname(databasePath), { recursive: true });

  let database;
  try {
    database = new SQL.Database(await readFile(databasePath));
    logger.info('SQLite database loaded', { path: databasePath });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    database = new SQL.Database();
    logger.info('SQLite database created', { path: databasePath });
  }

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      jid TEXT PRIMARY KEY, number TEXT, push_name TEXT,
      is_bot INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      jid TEXT PRIMARY KEY, subject TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      scope TEXT NOT NULL, scope_id TEXT NOT NULL, key TEXT NOT NULL,
      value TEXT, updated_at INTEGER NOT NULL,
      PRIMARY KEY (scope, scope_id, key)
    );
    CREATE TABLE IF NOT EXISTS command_stats (
      command TEXT PRIMARY KEY, usage_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_command_stats (
      user_jid TEXT NOT NULL, command TEXT NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_jid, command)
    );
  `);

  let dirty = false;
  let closed = false;
  let flushPromise = null;

  async function persist() {
    if (closed || !dirty) return;
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      await writeFile(databasePath, Buffer.from(database.export()));
      dirty = false;
    })().finally(() => { flushPromise = null; });
    return flushPromise;
  }

  const flushTimer = setInterval(() => {
    persist().catch((error) => logger.error('Database auto-save failed', {
      error: error?.message ?? String(error),
    }));
  }, 10_000);
  flushTimer.unref?.();

  function exec(sql, params = []) {
    const statement = database.prepare(sql);
    try {
      statement.bind(params);
      while (statement.step()) statement.getAsObject();
    } finally {
      statement.free();
    }
    dirty = true;
  }

  function get(sql, params = []) {
    const statement = database.prepare(sql);
    try {
      statement.bind(params);
      return statement.step() ? statement.getAsObject() : undefined;
    } finally {
      statement.free();
    }
  }

  function all(sql, params = []) {
    const statement = database.prepare(sql);
    const rows = [];
    try {
      statement.bind(params);
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  async function close() {
    if (closed) return;
    clearInterval(flushTimer);
    await persist();
    database.close();
    closed = true;
  }

  return Object.freeze({
    exec,
    get,
    all,
    persist,
    close,
    markDirty: () => { dirty = true; },
    get path() { return databasePath; },
  });
}
