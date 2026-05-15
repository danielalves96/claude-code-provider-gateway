import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const PRIVATE_FILE_MODE = 0o600;

export function writePrivateFile(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, { encoding: "utf-8", mode: PRIVATE_FILE_MODE });
  chmodPrivateFile(path);
}

export function appendPrivateFile(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, data, { encoding: "utf-8", mode: PRIVATE_FILE_MODE });
  chmodPrivateFile(path);
}

function chmodPrivateFile(path: string): void {
  try {
    chmodSync(path, PRIVATE_FILE_MODE);
  } catch {
    // Best-effort on platforms without POSIX permissions, especially Windows.
  }
}
