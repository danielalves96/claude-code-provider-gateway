import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SecretStore } from "./store.js";

interface EncryptedEntry {
  nonce: string; // hex, 12 bytes
  ciphertext: string; // hex
  tag: string; // hex, 16 bytes
}

type Cache = Record<string, EncryptedEntry>;

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;

export class EncryptedFileSecretStore implements SecretStore {
  private cache: Cache;

  constructor(
    private readonly filePath: string,
    private readonly masterKey: Buffer,
  ) {
    if (masterKey.length !== 32) {
      throw new Error(`Master key must be 32 bytes (got ${masterKey.length})`);
    }
    this.cache = this.readFromDisk();
  }

  get(key: string): string | null {
    const entry = this.cache[key];
    if (!entry) return null;
    try {
      return this.decrypt(entry);
    } catch {
      // Corrupt or wrongly-keyed entry (e.g. left over from a previous master
      // key). Treat as missing so a single bad secret can't take down config
      // load — the user re-enters that one credential via the UI.
      return null;
    }
  }

  set(key: string, value: string): void {
    if (value === "" || value == null) {
      this.delete(key);
      return;
    }
    this.cache[key] = this.encrypt(value);
    this.flush();
  }

  delete(key: string): void {
    if (!(key in this.cache)) return;
    delete this.cache[key];
    this.flush();
  }

  keys(): string[] {
    return Object.keys(this.cache);
  }

  private encrypt(plaintext: string): EncryptedEntry {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      nonce: nonce.toString("hex"),
      ciphertext: ciphertext.toString("hex"),
      tag: tag.toString("hex"),
    };
  }

  private decrypt(entry: EncryptedEntry): string {
    const nonce = Buffer.from(entry.nonce, "hex");
    const ciphertext = Buffer.from(entry.ciphertext, "hex");
    const tag = Buffer.from(entry.tag, "hex");
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf-8");
  }

  private readFromDisk(): Cache {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf-8")) as Cache;
    } catch {
      return {};
    }
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), { mode: 0o600 });
  }
}
