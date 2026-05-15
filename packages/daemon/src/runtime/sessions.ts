// Session persistence — each daemon process = one session.
// Sessions are stored in two files alongside config.json:
//   - current-session.json  → in-progress session, checkpointed every 10s
//   - sessions.jsonl        → completed sessions, one JSON object per line

import { randomBytes } from "node:crypto";
import type { Config, ProviderId } from "../config/schema.js";
import { logger } from "../observability/log.js";
import {
  applyRequestToSessionStats,
  normalizeSessionTotals,
  sessionTotals,
} from "./session-stats.js";
import {
  archiveSession,
  clearArchivedSessions as clearArchive,
  currentSessionExists,
  ensureSessionDir,
  listArchivedSessions as listArchive,
  readCurrentSession,
  removeCurrentSession,
  writeCurrentSession,
} from "./session-store.js";
import type { SessionRecord, SessionRequestLogEntry } from "./session-types.js";
import { getUptimeMs } from "./stats.js";

export type {
  SessionModelStat,
  SessionProviderStat,
  SessionRecord,
  SessionRequestLogEntry,
  TokenSaverStats,
} from "./session-types.js";

const HEARTBEAT_TIMEOUT_MS = 60_000;

let current: SessionRecord | null = null;
let checkpointTimer: NodeJS.Timeout | null = null;
let sessionPrimaryModel: { providerId: ProviderId; providerModel: string } | null = null;

export function setSessionPrimaryModel(providerId: ProviderId, providerModel: string): void {
  sessionPrimaryModel = { providerId, providerModel };
}

export function getSessionPrimaryModel(): { providerId: ProviderId; providerModel: string } | null {
  return sessionPrimaryModel;
}

export function isFirstSessionRequest(): boolean {
  return !current || current.requestLog.length === 0;
}

export function startSession(config: Config): SessionRecord {
  ensureSessionDir();
  recoverCrashedSessionIfNeeded();

  sessionPrimaryModel = null;
  current = createSessionRecord(config);
  writeCurrentSession(current);
  logger.info(
    "sessions",
    `started session ${current.id} (mode=${current.modelMode}, launch=${current.launchHint})`,
  );

  checkpointTimer = setInterval(checkpoint, 10_000);
  return current;
}

export function attachSessionProcess(
  sessionId: string | undefined,
  pid: number | undefined,
): boolean {
  if (!current || !sessionId || current.id !== sessionId) return false;
  if (!Number.isInteger(pid) || !pid || pid <= 0) return false;

  current.watchedPid = pid;
  current.lastHeartbeatAt = Date.now();
  persistCurrentSession("attach checkpoint failed");
  logger.info("sessions", `attached session ${current.id} to pid ${pid}`);
  return true;
}

export function heartbeatSession(sessionId: string | undefined): boolean {
  if (!current || !sessionId || current.id !== sessionId) return false;
  current.lastHeartbeatAt = Date.now();
  persistCurrentSession("heartbeat checkpoint failed");
  return true;
}

export function recordSessionRequest(
  entry: Omit<SessionRequestLogEntry, "id" | "timestamp">,
): string | undefined {
  if (!current) return undefined;

  const logEntry: SessionRequestLogEntry = {
    id: `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    timestamp: Date.now(),
    ...entry,
    requestedModel: normalizeRequestedModelForLog(entry.requestedModel),
    prompt: "prompt" in entry ? (entry as { prompt?: string }).prompt : undefined,
  };

  applyRequestToSessionStats(current, logEntry);
  return logEntry.id;
}

export function updateSessionRequestResponse(id: string, response: string): void {
  if (!current?.requestLog) return;
  const entry = current.requestLog.find((e) => e.id === id);
  if (entry) entry.response = response;
}

export function endSession(sessionId?: string): boolean {
  if (!current) return false;
  if (sessionId && current.id !== sessionId) return false;
  stopCheckpointTimer();

  const totals = sessionTotals(current);
  const finalized: SessionRecord = {
    ...current,
    endedAt: Date.now(),
    durationMs: Date.now() - current.startedAt,
    status: "completed",
    totalRequests: totals.totalRequests,
    totalErrors: totals.totalErrors,
  };

  archiveSession(finalized);
  removeCurrentSession();
  logger.info(
    "sessions",
    `ended session ${finalized.id} (${finalized.totalRequests} reqs, ${finalized.totalErrors} errors)`,
  );
  current = null;
  return true;
}

export function getCurrentSession(): SessionRecord | null {
  if (current && shouldEndSession(current)) {
    logger.warn("sessions", `session ${current.id} launcher is no longer alive`);
    endSession(current.id);
  }
  if (!current) return null;

  const totals = sessionTotals(current);
  return {
    ...current,
    totalRequests: totals.totalRequests,
    totalErrors: totals.totalErrors,
    durationMs: getUptimeMs(),
  };
}

export function clearArchivedSessions(): void {
  try {
    clearArchive();
  } catch (err) {
    logger.error("sessions", `failed to clear history: ${String(err)}`);
    throw err;
  }
}

export function listArchivedSessions(): SessionRecord[] {
  return listArchive();
}

function recoverCrashedSessionIfNeeded(): void {
  if (!currentSessionExists()) return;
  try {
    const prev = readCurrentSession();
    const recovered: SessionRecord = {
      ...normalizeSessionTotals(prev),
      endedAt: prev.endedAt ?? Date.now(),
      durationMs: (prev.endedAt ?? Date.now()) - prev.startedAt,
      status: "crashed",
    };
    archiveSession(recovered);
    logger.warn("sessions", `recovered crashed session ${recovered.id}`);
  } catch (err) {
    logger.error("sessions", `failed to recover previous session: ${String(err)}`);
  }
  removeCurrentSession();
}

function createSessionRecord(config: Config): SessionRecord {
  const enabledProviders = (
    Object.entries(config.providers) as [ProviderId, (typeof config.providers)[ProviderId]][]
  )
    .filter(([, pc]) => pc.enabled)
    .map(([id]) => id);
  const launchHint = config.modelMode === "all" ? "all" : config.activeProvider;

  return {
    id: randomBytes(8).toString("hex"),
    startedAt: Date.now(),
    endedAt: null,
    durationMs: 0,
    status: "running",
    modelMode: config.modelMode ?? "single",
    activeProvider: config.activeProvider,
    launchHint,
    enabledProviders,
    providerStats: {},
    modelStats: {},
    requestLog: [],
    totalRequests: 0,
    totalErrors: 0,
    lastHeartbeatAt: Date.now(),
  };
}

function checkpoint(): void {
  if (!current) return;
  if (shouldEndSession(current)) {
    logger.warn("sessions", `session ${current.id} launcher is no longer alive`);
    endSession(current.id);
    return;
  }

  const totals = sessionTotals(current);
  current.totalRequests = totals.totalRequests;
  current.totalErrors = totals.totalErrors;
  current.durationMs = getUptimeMs();
  persistCurrentSession("checkpoint failed");
}

function shouldEndSession(session: SessionRecord): boolean {
  if (session.watchedPid) return !isProcessAlive(session.watchedPid);
  return !!session.lastHeartbeatAt && Date.now() - session.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function persistCurrentSession(errorMessage: string): void {
  if (!current) return;
  try {
    writeCurrentSession(current);
  } catch (err) {
    logger.error("sessions", `${errorMessage}: ${String(err)}`);
  }
}

function stopCheckpointTimer(): void {
  if (!checkpointTimer) return;
  clearInterval(checkpointTimer);
  checkpointTimer = null;
}

function normalizeRequestedModelForLog(model: string): string {
  if (model.startsWith("anthropic/")) return model.slice("anthropic/".length);
  return model;
}
