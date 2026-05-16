import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { getConfigDir, getCurrentSessionPath, getSessionArchivePath } from "../config/paths.js";
import { appendPrivateFile, writePrivateFile } from "../core/files/private-file.js";
import { normalizeSessionTotals } from "./session-stats.js";
import type { SessionRecord } from "./session-types.js";

const CURRENT_PATH = getCurrentSessionPath();
const ARCHIVE_PATH = getSessionArchivePath();
const MAX_SESSIONS = 200;

export function ensureSessionDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function currentSessionExists(): boolean {
  return existsSync(CURRENT_PATH);
}

export function readCurrentSession(): SessionRecord {
  return JSON.parse(readFileSync(CURRENT_PATH, "utf-8")) as SessionRecord;
}

export function writeCurrentSession(session: SessionRecord): void {
  writePrivateFile(CURRENT_PATH, JSON.stringify(session));
}

export function removeCurrentSession(): void {
  try {
    unlinkSync(CURRENT_PATH);
  } catch {}
}

export function archiveSession(session: SessionRecord): void {
  ensureSessionDir();
  appendPrivateFile(ARCHIVE_PATH, `${JSON.stringify(session)}\n`);
  trimArchivedSessions();
}

export function clearArchivedSessions(): void {
  ensureSessionDir();
  writePrivateFile(ARCHIVE_PATH, "");
}

export function listArchivedSessions(): SessionRecord[] {
  if (!existsSync(ARCHIVE_PATH)) return [];
  try {
    const raw = readFileSync(ARCHIVE_PATH, "utf-8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map(parseArchivedLine)
      .filter((s): s is SessionRecord => s !== null)
      .reverse();
  } catch {
    return [];
  }
}

function trimArchivedSessions(): void {
  try {
    const lines = readFileSync(ARCHIVE_PATH, "utf-8").split("\n").filter(Boolean);
    if (lines.length > MAX_SESSIONS) {
      writePrivateFile(ARCHIVE_PATH, `${lines.slice(-MAX_SESSIONS).join("\n")}\n`);
    }
  } catch {}
}

function parseArchivedLine(line: string): SessionRecord | null {
  try {
    return normalizeSessionTotals(JSON.parse(line) as SessionRecord);
  } catch {
    return null;
  }
}
