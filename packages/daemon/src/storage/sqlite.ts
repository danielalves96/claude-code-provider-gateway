import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DatabaseSync as DatabaseSyncInstance } from "node:sqlite";
import type { SessionRecord } from "../runtime/sessions/types.js";

const require = createRequire(import.meta.url);

// Resolved lazily, never at module load. This module is reachable from the
// startup import graph (config -> storage), but `bun build --compile`
// standalone binaries (how the daemon sidecar ships) don't include
// node:sqlite as a built-in on every Bun version. Requiring it eagerly
// killed the desktop app on launch even though desktop is file-backed and
// never opens a database. See issue #29.
let sqliteModuleCtor: typeof import("node:sqlite").DatabaseSync | null = null;

function loadDatabaseSyncCtor(): typeof import("node:sqlite").DatabaseSync {
  if (sqliteModuleCtor) return sqliteModuleCtor;
  try {
    sqliteModuleCtor =
      typeof (globalThis as { Bun?: unknown }).Bun !== "undefined"
        ? (require("bun:sqlite").Database as typeof import("node:sqlite").DatabaseSync)
        : (require("node:sqlite").DatabaseSync as typeof import("node:sqlite").DatabaseSync);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `SQLite storage backend is unavailable: this runtime has no usable sqlite module (${reason}). ` +
        "Use Node.js >= 22.5 or Bun >= 1.4, or unset CCPG_STORAGE_BACKEND and CCPG_SQLITE_PATH " +
        "to fall back to file storage.",
    );
  }
  return sqliteModuleCtor;
}

const DEFAULT_SQLITE_PATH = "/data/ccpg.sqlite";
const CONFIG_KEY = "config";
const MAX_ARCHIVED_SESSIONS = 200;

let database: DatabaseSyncInstance | null = null;

export function isSqliteStorageEnabled(): boolean {
  return process.env.CCPG_STORAGE_BACKEND === "sqlite" || !!process.env.CCPG_SQLITE_PATH;
}

export function getSqlitePath(): string {
  return process.env.CCPG_SQLITE_PATH || DEFAULT_SQLITE_PATH;
}

export function getSqliteDatabase(): DatabaseSyncInstance {
  if (database) return database;
  const DatabaseSync = loadDatabaseSyncCtor();
  const path = getSqlitePath();
  mkdirSync(dirname(path), { recursive: true });
  database = new DatabaseSync(path);
  migrate(database);
  return database;
}

export function closeSqliteDatabase(): void {
  database?.close();
  database = null;
}

export function readConfigJson(): string | null {
  const row = getSqliteDatabase()
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get(CONFIG_KEY) as { value: string } | undefined;
  return row?.value ?? null;
}

export function writeConfigJson(value: string): void {
  getSqliteDatabase()
    .prepare(
      "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .run(CONFIG_KEY, value, Date.now());
}

export function readSecretEntry(key: string): string | null {
  const row = getSqliteDatabase()
    .prepare("SELECT value FROM secret_entries WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function writeSecretEntry(key: string, value: string): void {
  getSqliteDatabase()
    .prepare(
      "INSERT INTO secret_entries (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .run(key, value, Date.now());
}

export function deleteSecretEntry(key: string): void {
  getSqliteDatabase().prepare("DELETE FROM secret_entries WHERE key = ?").run(key);
}

export function listSecretKeys(): string[] {
  return getSqliteDatabase()
    .prepare("SELECT key FROM secret_entries ORDER BY key")
    .all()
    .map((row) => (row as { key: string }).key);
}

export function currentSessionsExist(): boolean {
  const row = getSqliteDatabase().prepare("SELECT 1 AS found FROM active_sessions LIMIT 1").get() as
    | { found: number }
    | undefined;
  return !!row;
}

export function readCurrentSessionsFromSqlite(): SessionRecord[] {
  return getSqliteDatabase()
    .prepare("SELECT data FROM active_sessions ORDER BY started_at DESC")
    .all()
    .map((row) => JSON.parse((row as { data: string }).data) as SessionRecord);
}

export function writeCurrentSessionsToSqlite(sessions: SessionRecord[]): void {
  const db = getSqliteDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM active_sessions").run();
    const insert = db.prepare(
      "INSERT INTO active_sessions (id, started_at, data, updated_at) VALUES (?, ?, ?, ?)",
    );
    const updatedAt = Date.now();
    for (const session of sessions) {
      insert.run(session.id, session.startedAt, JSON.stringify(session), updatedAt);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function removeCurrentSessionsFromSqlite(): void {
  getSqliteDatabase().prepare("DELETE FROM active_sessions").run();
}

export function archiveSessionToSqlite(session: SessionRecord): void {
  const db = getSqliteDatabase();
  db.prepare(
    "INSERT INTO archived_sessions (id, started_at, ended_at, data, updated_at) " +
      "VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, ended_at = excluded.ended_at, data = excluded.data, updated_at = excluded.updated_at",
  ).run(
    session.id,
    session.startedAt,
    session.endedAt ?? Date.now(),
    JSON.stringify(session),
    Date.now(),
  );
  trimArchivedSessions(db);
}

export function clearArchivedSessionsFromSqlite(): void {
  getSqliteDatabase().prepare("DELETE FROM archived_sessions").run();
}

export function deleteArchivedSessionFromSqlite(id: string): boolean {
  const result = getSqliteDatabase().prepare("DELETE FROM archived_sessions WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listArchivedSessionsFromSqlite(): SessionRecord[] {
  return getSqliteDatabase()
    .prepare("SELECT data FROM archived_sessions ORDER BY ended_at DESC, started_at DESC")
    .all()
    .map((row) => JSON.parse((row as { data: string }).data) as SessionRecord);
}

function migrate(db: DatabaseSyncInstance): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS secret_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS active_sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS archived_sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_archived_sessions_ended_at
      ON archived_sessions (ended_at DESC, started_at DESC);
  `);
}

function trimArchivedSessions(db: DatabaseSyncInstance): void {
  db.prepare(
    "DELETE FROM archived_sessions WHERE id NOT IN (" +
      "SELECT id FROM archived_sessions ORDER BY ended_at DESC, started_at DESC LIMIT ?" +
      ")",
  ).run(MAX_ARCHIVED_SESSIONS);
}
