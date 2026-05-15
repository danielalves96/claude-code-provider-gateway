import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EncryptedFileSecretStore } from "./encrypted-file-store.js";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "secret-store-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("round-trips a secret through encrypt/decrypt", () => {
  withTempDir((dir) => {
    const store = new EncryptedFileSecretStore(join(dir, "secrets.json"), randomBytes(32));
    store.set("provider.openrouter.apiKey", "sk-or-v1-test");
    assert.equal(store.get("provider.openrouter.apiKey"), "sk-or-v1-test");
  });
});

test("returns null for missing keys", () => {
  withTempDir((dir) => {
    const store = new EncryptedFileSecretStore(join(dir, "secrets.json"), randomBytes(32));
    assert.equal(store.get("does.not.exist"), null);
  });
});

test("persists across instances when master key matches", () => {
  withTempDir((dir) => {
    const file = join(dir, "secrets.json");
    const key = randomBytes(32);
    new EncryptedFileSecretStore(file, key).set("a", "one");
    const reopened = new EncryptedFileSecretStore(file, key);
    assert.equal(reopened.get("a"), "one");
  });
});

test("wrong master key treats the entry as missing", () => {
  withTempDir((dir) => {
    const file = join(dir, "secrets.json");
    new EncryptedFileSecretStore(file, randomBytes(32)).set("a", "one");
    const wrong = new EncryptedFileSecretStore(file, randomBytes(32));
    assert.equal(wrong.get("a"), null);
  });
});

test("set with empty value deletes the entry", () => {
  withTempDir((dir) => {
    const store = new EncryptedFileSecretStore(join(dir, "secrets.json"), randomBytes(32));
    store.set("a", "one");
    store.set("a", "");
    assert.equal(store.get("a"), null);
    assert.deepEqual(store.keys(), []);
  });
});

test("on-disk file never contains plaintext", () => {
  withTempDir((dir) => {
    const file = join(dir, "secrets.json");
    const store = new EncryptedFileSecretStore(file, randomBytes(32));
    store.set("provider.openrouter.apiKey", "plaintext-sentinel");
    const raw = readFileSync(file, "utf-8");
    assert.ok(!raw.includes("plaintext-sentinel"), "plaintext leaked into JSON");
  });
});

test("rejects 32-byte requirement on construction", () => {
  withTempDir((dir) => {
    assert.throws(
      () => new EncryptedFileSecretStore(join(dir, "secrets.json"), randomBytes(16)),
      /32 bytes/,
    );
  });
});

test("tolerates a corrupt secrets file by treating it as empty", () => {
  withTempDir((dir) => {
    const file = join(dir, "secrets.json");
    writeFileSync(file, "not json at all", "utf-8");
    const store = new EncryptedFileSecretStore(file, randomBytes(32));
    assert.deepEqual(store.keys(), []);
  });
});
