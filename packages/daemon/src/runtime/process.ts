import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getPidPath } from "../config/index.js";

export function writePid(pid: number): void {
  const path = getPidPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, String(pid), "utf-8");
}

export function readPid(): number | null {
  const path = getPidPath();
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8").trim();
  const pid = parseInt(raw, 10);
  return Number.isNaN(pid) ? null : pid;
}

export function removePid(): void {
  const path = getPidPath();
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Best-effort cleanup: status checks should not fail because a stale PID
    // file cannot be removed in a restricted environment.
  }
}

export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getDaemonStatus(): { running: boolean; pid: number | null } {
  const pid = readPid();
  if (pid === null) return { running: false, pid: null };
  const running = isRunning(pid);
  if (!running) removePid();
  return { running, pid: running ? pid : null };
}
