import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveMasterKey } from "./master-key.js";

const ENV_VAR = "CC_GATEWAY_SECRET_KEY";

function withTempFile(fn: (file: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "master-key-"));
  const previousEnv = process.env[ENV_VAR];
  delete process.env[ENV_VAR];
  try {
    fn(join(dir, "secret.key"));
  } finally {
    if (previousEnv !== undefined) process.env[ENV_VAR] = previousEnv;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("generates and persists a 32-byte key on first call", () => {
  withTempFile((file) => {
    const { origin, key } = resolveMasterKey(file);
    assert.equal(origin, "file-generated");
    assert.equal(key.length, 32);
    assert.ok(existsSync(file));
    const fromDisk = Buffer.from(readFileSync(file, "utf-8").trim(), "hex");
    assert.deepEqual(fromDisk, key);
  });
});

test("returns the same key on subsequent calls", () => {
  withTempFile((file) => {
    const first = resolveMasterKey(file);
    const second = resolveMasterKey(file);
    assert.equal(second.origin, "file-existing");
    assert.deepEqual(second.key, first.key);
  });
});

test("env var takes precedence over file", () => {
  withTempFile((file) => {
    const envKey = randomBytes(32);
    process.env[ENV_VAR] = envKey.toString("hex");
    const { origin, key } = resolveMasterKey(file);
    assert.equal(origin, "env");
    assert.deepEqual(key, envKey);
    assert.ok(!existsSync(file), "should not create key file when env is set");
  });
});

test("rejects env var with wrong byte length", () => {
  withTempFile((file) => {
    process.env[ENV_VAR] = "00".repeat(16);
    assert.throws(() => resolveMasterKey(file), /32-byte/);
  });
});

test("rejects corrupt key file", () => {
  withTempFile((file) => {
    writeFileSync(file, "not hex");
    assert.throws(() => resolveMasterKey(file), /corrupt/);
  });
});

test("persists key file with 0600 perms on POSIX", (t) => {
  if (platform() === "win32") return t.skip("POSIX-only");
  withTempFile((file) => {
    resolveMasterKey(file);
    const mode = statSync(file).mode & 0o777;
    assert.equal(mode, 0o600);
  });
});
