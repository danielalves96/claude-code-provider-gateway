import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const MASTER_KEY_ENV = "CC_GATEWAY_SECRET_KEY";
const KEY_BYTES = 32;

export interface MasterKeySource {
  origin: "env" | "file-existing" | "file-generated";
  key: Buffer;
}

// Resolution order:
//   1. CC_GATEWAY_SECRET_KEY env var (hex, 32 bytes) — supplied by Tauri supervisor
//   2. Existing key file at `filePath`
//   3. Generate fresh key, persist with 0600 perms (dev fallback)
export function resolveMasterKey(filePath: string): MasterKeySource {
  const fromEnv = readEnvKey();
  if (fromEnv) return { origin: "env", key: fromEnv };

  if (existsSync(filePath)) {
    return { origin: "file-existing", key: readKeyFile(filePath) };
  }

  const generated = randomBytes(KEY_BYTES);
  persistKeyFile(filePath, generated);
  return { origin: "file-generated", key: generated };
}

function readEnvKey(): Buffer | null {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) return null;
  const buf = Buffer.from(raw.trim(), "hex");
  if (buf.length !== KEY_BYTES) {
    throw new Error(`${MASTER_KEY_ENV} must be ${KEY_BYTES}-byte hex (got ${buf.length} bytes)`);
  }
  return buf;
}

function readKeyFile(filePath: string): Buffer {
  const buf = Buffer.from(readFileSync(filePath, "utf-8").trim(), "hex");
  if (buf.length !== KEY_BYTES) {
    throw new Error(`Master key file at ${filePath} is corrupt (expected ${KEY_BYTES} bytes hex)`);
  }
  return buf;
}

function persistKeyFile(filePath: string, key: Buffer): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, key.toString("hex"), { encoding: "utf-8", mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort on platforms without POSIX perms (Windows)
  }
}
