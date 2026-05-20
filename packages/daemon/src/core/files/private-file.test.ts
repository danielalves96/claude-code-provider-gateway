import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendPrivateFile, writePrivateFile } from "./private-file.js";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "private-file-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function posixMode(path: string): number {
  return statSync(path).mode & 0o777;
}

test("writePrivateFile writes with owner-only permissions on POSIX", (t) => {
  if (platform() === "win32") return t.skip("POSIX-only");

  withTempDir((dir) => {
    const file = join(dir, "history.json");
    writePrivateFile(file, '{"ok":true}');

    assert.equal(readFileSync(file, "utf-8"), '{"ok":true}');
    assert.equal(posixMode(file), 0o600);
  });
});

test("appendPrivateFile tightens permissions on existing files", (t) => {
  if (platform() === "win32") return t.skip("POSIX-only");

  withTempDir((dir) => {
    const file = join(dir, "sessions.jsonl");
    writeFileSync(file, "old\n", "utf-8");
    chmodSync(file, 0o644);

    appendPrivateFile(file, "new\n");

    assert.equal(readFileSync(file, "utf-8"), "old\nnew\n");
    assert.equal(posixMode(file), 0o600);
  });
});
