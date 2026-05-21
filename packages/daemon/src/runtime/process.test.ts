import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach, beforeEach } from "node:test";

let originalConfigDir: string | undefined;
let tmpDir: string;

beforeEach(() => {
  originalConfigDir = process.env.CCPG_CONFIG_DIR;
  tmpDir = join(tmpdir(), `ccpg-process-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  process.env.CCPG_CONFIG_DIR = tmpDir;
});

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.CCPG_CONFIG_DIR;
  else process.env.CCPG_CONFIG_DIR = originalConfigDir;
  try {
    if (existsSync(join(tmpDir, "daemon.pid"))) unlinkSync(join(tmpDir, "daemon.pid"));
    if (existsSync(tmpDir)) unlinkSync(tmpDir);
  } catch {}
});

test("writePid writes pid file with correct content", async () => {
  const { writePid } = await import("./process.js");
  writePid(12345);

  const pidPath = join(tmpDir, "daemon.pid");
  assert.equal(existsSync(pidPath), true);
  assert.equal(readFileSync(pidPath, "utf-8"), "12345");
});

test("readPid returns pid from file", async () => {
  const { writePid, readPid } = await import("./process.js");
  writePid(67890);
  assert.equal(readPid(), 67890);
});

test("readPid returns null when file does not exist", async () => {
  const { readPid } = await import("./process.js");
  assert.equal(readPid(), null);
});

test("readPid returns null for invalid content", async () => {
  const { readPid } = await import("./process.js");
  const pidPath = join(tmpDir, "daemon.pid");
  writeFileSync(pidPath, "not-a-number", "utf-8");
  assert.equal(readPid(), null);
});

test("readPid returns null for empty file", async () => {
  const { readPid } = await import("./process.js");
  const pidPath = join(tmpDir, "daemon.pid");
  writeFileSync(pidPath, "", "utf-8");
  assert.equal(readPid(), null);
});

test("removePid deletes pid file", async () => {
  const { writePid, removePid } = await import("./process.js");
  writePid(11111);
  assert.equal(existsSync(join(tmpDir, "daemon.pid")), true);
  removePid();
  assert.equal(existsSync(join(tmpDir, "daemon.pid")), false);
});

test("removePid does not throw when file does not exist", async () => {
  const { removePid } = await import("./process.js");
  assert.doesNotThrow(() => removePid());
});

test("isRunning returns true for own process", async () => {
  const { isRunning } = await import("./process.js");
  assert.equal(isRunning(process.pid), true);
});

test("isRunning returns false for non-existent pid", async () => {
  const { isRunning } = await import("./process.js");
  assert.equal(isRunning(99999999), false);
});

test("getDaemonStatus returns running:false when no pid file", async () => {
  const { getDaemonStatus } = await import("./process.js");
  const status = getDaemonStatus();
  assert.equal(status.running, false);
  assert.equal(status.pid, null);
});

test("getDaemonStatus returns running:true for running process", async () => {
  const { writePid, getDaemonStatus } = await import("./process.js");
  writePid(process.pid);
  const status = getDaemonStatus();
  assert.equal(status.running, true);
  assert.equal(status.pid, process.pid);
});

test("getDaemonStatus removes stale pid file for dead process", async () => {
  const { writePid, getDaemonStatus } = await import("./process.js");
  writePid(99999999);
  const pidPath = join(tmpDir, "daemon.pid");
  assert.equal(existsSync(pidPath), true);
  const status = getDaemonStatus();
  assert.equal(status.running, false);
  assert.equal(status.pid, null);
  assert.equal(existsSync(pidPath), false);
});
