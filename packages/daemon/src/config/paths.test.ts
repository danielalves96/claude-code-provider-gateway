import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test, { afterEach, beforeEach } from "node:test";

let originalConfigDir: string | undefined;
const TEST_DIR = "/tmp/ccpg-paths-test";

beforeEach(() => {
  originalConfigDir = process.env.CCPG_CONFIG_DIR;
  process.env.CCPG_CONFIG_DIR = TEST_DIR;
});

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.CCPG_CONFIG_DIR;
  else process.env.CCPG_CONFIG_DIR = originalConfigDir;
});

test("getConfigDir returns CCPG_CONFIG_DIR when set", async () => {
  const { getConfigDir } = await import("./paths.js");
  assert.equal(getConfigDir(), TEST_DIR);
});

test("getConfigPath returns config.json inside config dir", async () => {
  const { getConfigPath } = await import("./paths.js");
  assert.equal(getConfigPath(), join(TEST_DIR, "config.json"));
});

test("getPidPath returns daemon.pid inside config dir", async () => {
  const { getPidPath } = await import("./paths.js");
  assert.equal(getPidPath(), join(TEST_DIR, "daemon.pid"));
});

test("getLogPath returns daemon.log inside config dir", async () => {
  const { getLogPath } = await import("./paths.js");
  assert.equal(getLogPath(), join(TEST_DIR, "daemon.log"));
});

test("getSecretsPath returns secrets.enc.json inside config dir", async () => {
  const { getSecretsPath } = await import("./paths.js");
  assert.equal(getSecretsPath(), join(TEST_DIR, "secrets.enc.json"));
});

test("getMasterKeyPath returns secret.key inside config dir", async () => {
  const { getMasterKeyPath } = await import("./paths.js");
  assert.equal(getMasterKeyPath(), join(TEST_DIR, "secret.key"));
});

test("getCurrentSessionPath returns current-session.json inside config dir", async () => {
  const { getCurrentSessionPath } = await import("./paths.js");
  assert.equal(getCurrentSessionPath(), join(TEST_DIR, "current-session.json"));
});

test("getSessionArchivePath returns sessions.jsonl inside config dir", async () => {
  const { getSessionArchivePath } = await import("./paths.js");
  assert.equal(getSessionArchivePath(), join(TEST_DIR, "sessions.jsonl"));
});

test("getProviderLogoDir returns provider-logos inside config dir", async () => {
  const { getProviderLogoDir } = await import("./paths.js");
  assert.equal(getProviderLogoDir(), join(TEST_DIR, "provider-logos"));
});

test("getConfigDir falls back to homedir-based path when env unset", async () => {
  delete process.env.CCPG_CONFIG_DIR;
  const { getConfigDir } = await import("./paths.js");
  const dir = getConfigDir();
  // Should include homedir somewhere in the path
  assert.ok(dir.startsWith(homedir()) || dir.includes("claude-code-provider-gateway"));
  process.env.CCPG_CONFIG_DIR = TEST_DIR;
});
