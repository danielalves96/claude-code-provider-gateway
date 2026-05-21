import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach, beforeEach } from "node:test";
import type { SessionRecord } from "./types.js";

let originalConfigDir: string | undefined;
let tmpDir: string;

beforeEach(() => {
  originalConfigDir = process.env.CCPG_CONFIG_DIR;
  tmpDir = join(tmpdir(), `ccpg-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  process.env.CCPG_CONFIG_DIR = tmpDir;
});

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.CCPG_CONFIG_DIR;
  else process.env.CCPG_CONFIG_DIR = originalConfigDir;
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

function makeSession(overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    id: `sess_${Date.now()}`,
    startedAt: Date.now(),
    endedAt: null,
    durationMs: 0,
    status: "running",
    modelMode: "all",
    activeProvider: "ollama",
    launchHint: "all",
    enabledProviders: ["ollama"],
    providerStats: {},
    modelStats: {},
    requestLog: [],
    totalRequests: 0,
    totalErrors: 0,
    ...overrides,
  };
}

test("currentSessionExists returns false when no session file exists", async () => {
  const { currentSessionExists } = await import("./store.js");
  assert.equal(currentSessionExists(), false);
});

test("writeCurrentSession and readCurrentSession round-trip", async () => {
  const { writeCurrentSession, readCurrentSession } = await import("./store.js");
  const session = makeSession({ id: "sess_roundtrip" });
  writeCurrentSession(session);
  const read = readCurrentSession();
  assert.equal(read.id, "sess_roundtrip");
  assert.equal(read.status, "running");
});

test("currentSessionExists returns true after writeCurrentSession", async () => {
  const { writeCurrentSession, currentSessionExists } = await import("./store.js");
  writeCurrentSession(makeSession({ id: "sess_exists" }));
  assert.equal(currentSessionExists(), true);
});

test("removeCurrentSession removes the session file", async () => {
  const { writeCurrentSession, currentSessionExists, removeCurrentSession } = await import("./store.js");
  writeCurrentSession(makeSession());
  assert.equal(currentSessionExists(), true);
  removeCurrentSession();
  assert.equal(currentSessionExists(), false);
});

test("removeCurrentSession does not throw when file does not exist", async () => {
  const { removeCurrentSession } = await import("./store.js");
  assert.doesNotThrow(() => removeCurrentSession());
});

test("writeCurrentSessions and readCurrentSessions round-trip array", async () => {
  const { writeCurrentSessions, readCurrentSessions } = await import("./store.js");
  const sessions = [makeSession({ id: "s1" }), makeSession({ id: "s2" })];
  writeCurrentSessions(sessions);
  const read = readCurrentSessions();
  assert.equal(read.length, 2);
  assert.equal(read[0]?.id, "s1");
  assert.equal(read[1]?.id, "s2");
});

test("readCurrentSessions handles single session JSON (backward compat)", async () => {
  const { writeCurrentSession, readCurrentSessions } = await import("./store.js");
  writeCurrentSession(makeSession({ id: "single" }));
  const sessions = readCurrentSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.id, "single");
});

test("archiveSession writes to sessions.jsonl", async () => {
  const { archiveSession, listArchivedSessions } = await import("./store.js");
  const session = makeSession({ id: "archived_1", status: "ended", endedAt: Date.now() });
  archiveSession(session);
  const list = listArchivedSessions();
  assert.ok(list.some((s) => s.id === "archived_1"));
});

test("listArchivedSessions returns empty array when no archive", async () => {
  const { listArchivedSessions } = await import("./store.js");
  const list = listArchivedSessions();
  assert.deepEqual(list, []);
});

test("listArchivedSessions returns sessions in reverse order", async () => {
  const { archiveSession, listArchivedSessions } = await import("./store.js");
  archiveSession(makeSession({ id: "first", startedAt: 1000 }));
  archiveSession(makeSession({ id: "second", startedAt: 2000 }));
  const list = listArchivedSessions();
  assert.equal(list.length, 2);
  // reverse order: most recent first
  assert.equal(list[0]?.id, "second");
  assert.equal(list[1]?.id, "first");
});

test("deleteArchivedSession removes a session by id", async () => {
  const { archiveSession, deleteArchivedSession, listArchivedSessions } = await import("./store.js");
  archiveSession(makeSession({ id: "to_delete" }));
  archiveSession(makeSession({ id: "to_keep" }));
  const deleted = deleteArchivedSession("to_delete");
  assert.equal(deleted, true);
  const list = listArchivedSessions();
  assert.ok(!list.some((s) => s.id === "to_delete"));
  assert.ok(list.some((s) => s.id === "to_keep"));
});

test("deleteArchivedSession returns false when id not found", async () => {
  const { deleteArchivedSession } = await import("./store.js");
  const result = deleteArchivedSession("nonexistent");
  assert.equal(result, false);
});

test("deleteArchivedSession returns false when archive file does not exist", async () => {
  const { deleteArchivedSession } = await import("./store.js");
  const result = deleteArchivedSession("any_id");
  assert.equal(result, false);
});

test("clearArchivedSessions empties the archive", async () => {
  const { archiveSession, clearArchivedSessions, listArchivedSessions } = await import("./store.js");
  archiveSession(makeSession({ id: "s1" }));
  archiveSession(makeSession({ id: "s2" }));
  clearArchivedSessions();
  const list = listArchivedSessions();
  assert.deepEqual(list, []);
});

test("listArchivedSessions deduplicates by id", async () => {
  const { archiveSession, listArchivedSessions } = await import("./store.js");
  const session = makeSession({ id: "dup_session" });
  archiveSession(session);
  archiveSession(session);
  const list = listArchivedSessions();
  const count = list.filter((s) => s.id === "dup_session").length;
  assert.equal(count, 1);
});

test("ensureSessionDir creates the config directory", async () => {
  const { ensureSessionDir } = await import("./store.js");
  const newDir = join(tmpDir, "subdir");
  process.env.CCPG_CONFIG_DIR = newDir;
  assert.equal(existsSync(newDir), false);
  ensureSessionDir();
  assert.equal(existsSync(newDir), true);
  process.env.CCPG_CONFIG_DIR = tmpDir;
});

test("archiveSession trims to MAX_SESSIONS after overflow", async () => {
  const { archiveSession, listArchivedSessions } = await import("./store.js");
  for (let i = 0; i < 205; i++) {
    archiveSession(makeSession({ id: `sess_${i}` }));
  }
  const list = listArchivedSessions();
  assert.ok(list.length <= 200);
});
