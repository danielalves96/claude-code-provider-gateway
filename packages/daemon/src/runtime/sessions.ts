// Session persistence — each launcher invocation gets its own active session.
// Sessions are stored in two files alongside config.json:
//   - current-session.json  → active sessions, checkpointed every 10s
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
  deleteArchivedSession as deleteArchived,
  ensureSessionDir,
  listArchivedSessions as listArchive,
  readCurrentSessions,
  removeCurrentSession,
  writeCurrentSessions,
} from "./session-store.js";
import type { SessionRecord, SessionRequestLogEntry } from "./session-types.js";

export type {
  SessionModelStat,
  SessionProviderStat,
  SessionRecord,
  SessionRequestLogEntry,
  TokenSaverStats,
} from "./session-types.js";

const HEARTBEAT_TIMEOUT_MS = 60_000;

interface SessionProfile {
  config: Config;
  authToken: string;
  primaryModel: { providerId: string; providerModel: string } | null;
}

const activeSessions = new Map<string, SessionRecord>();
const sessionProfiles = new Map<string, SessionProfile>();
const authSessionIds = new Map<string, string>();
let checkpointTimer: NodeJS.Timeout | null = null;
let recoveredCrashedSessions = false;

export function createLaunchAuthToken(): string {
  return `ccpg_${randomBytes(24).toString("base64url")}`;
}

export function resolveSessionIdFromAuthToken(token: string | undefined): string | null {
  if (!token) return null;
  return authSessionIds.get(token) ?? null;
}

export function getSessionConfig(sessionId: string | null | undefined): Config | null {
  if (!sessionId) return null;
  return sessionProfiles.get(sessionId)?.config ?? null;
}

export function setSessionPrimaryModel(
  sessionId: string | null | undefined,
  providerId: string,
  providerModel: string,
): void {
  const profile = sessionId ? sessionProfiles.get(sessionId) : null;
  if (profile) profile.primaryModel = { providerId, providerModel };
}

export function getSessionPrimaryModel(
  sessionId: string | null | undefined,
): { providerId: string; providerModel: string } | null {
  return sessionId ? (sessionProfiles.get(sessionId)?.primaryModel ?? null) : null;
}

export function isFirstSessionRequest(sessionId?: string | null): boolean {
  const session = sessionId ? activeSessions.get(sessionId) : getLatestActiveSession();
  return !session || session.requestLog.length === 0;
}

export function startSession(config: Config, authToken = createLaunchAuthToken()): SessionRecord {
  ensureSessionDir();
  recoverCrashedSessionsIfNeeded();
  recoveredCrashedSessions = true;

  const session = createSessionRecord(config);
  activeSessions.set(session.id, session);
  sessionProfiles.set(session.id, {
    authToken,
    config: cloneConfig(config),
    primaryModel: null,
  });
  authSessionIds.set(authToken, session.id);
  persistActiveSessions("start checkpoint failed");
  ensureCheckpointTimer();

  logger.info(
    "sessions",
    `started session ${session.id} (mode=${session.modelMode}, launch=${session.launchHint})`,
  );
  return session;
}

export function attachSessionProcess(
  sessionId: string | undefined,
  pid: number | undefined,
): boolean {
  const session = sessionId ? activeSessions.get(sessionId) : undefined;
  if (!session) return false;
  if (!Number.isInteger(pid) || !pid || pid <= 0) return false;

  session.watchedPid = pid;
  session.lastHeartbeatAt = Date.now();
  persistActiveSessions("attach checkpoint failed");
  logger.info("sessions", `attached session ${session.id} to pid ${pid}`);
  return true;
}

export function heartbeatSession(sessionId: string | undefined): boolean {
  const session = sessionId ? activeSessions.get(sessionId) : undefined;
  if (!session) return false;
  session.lastHeartbeatAt = Date.now();
  persistActiveSessions("heartbeat checkpoint failed");
  return true;
}

export function recordSessionRequest(
  sessionId: string | null | undefined,
  entry: Omit<SessionRequestLogEntry, "id" | "timestamp">,
): string | undefined {
  const session = sessionId ? activeSessions.get(sessionId) : getLatestActiveSession();
  if (!session) return undefined;

  const logEntry: SessionRequestLogEntry = {
    id: `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`,
    timestamp: Date.now(),
    ...entry,
    requestedModel: normalizeRequestedModelForLog(entry.requestedModel),
    prompt: "prompt" in entry ? (entry as { prompt?: string }).prompt : undefined,
  };

  applyRequestToSessionStats(session, logEntry);
  return `${session.id}:${logEntry.id}`;
}

export function updateSessionRequestResponse(
  compositeId: string | undefined,
  response: string,
): void {
  if (!compositeId) return;
  const { sessionId, entryId } = splitCompositeLogId(compositeId);
  const session = activeSessions.get(sessionId);
  if (!session?.requestLog) return;
  const entry = session.requestLog.find((e) => e.id === entryId);
  if (entry) entry.response = response;
}

export function endSession(sessionId?: string): boolean {
  if (!sessionId) {
    const latest = getLatestActiveSession();
    if (!latest) return false;
    return endSession(latest.id);
  }

  const session = activeSessions.get(sessionId);
  if (!session) return false;

  const totals = sessionTotals(session);
  const finalized: SessionRecord = {
    ...session,
    endedAt: Date.now(),
    durationMs: Date.now() - session.startedAt,
    status: "completed",
    totalRequests: totals.totalRequests,
    totalErrors: totals.totalErrors,
  };

  archiveSession(finalized);
  removeActiveSession(sessionId);
  persistActiveSessions("end checkpoint failed");
  if (activeSessions.size === 0) stopCheckpointTimer();
  logger.info(
    "sessions",
    `ended session ${finalized.id} (${finalized.totalRequests} reqs, ${finalized.totalErrors} errors)`,
  );
  return true;
}

export function endAllSessions(): void {
  for (const sessionId of Array.from(activeSessions.keys())) {
    endSession(sessionId);
  }
}

export function getCurrentSession(): SessionRecord | null {
  const sessions = listCurrentSessions();
  return sessions[0] ?? null;
}

export function listCurrentSessions(): SessionRecord[] {
  recoverCrashedSessionsIfNeeded();
  closeExpiredSessions();
  return Array.from(activeSessions.values())
    .map(withComputedTotals)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function clearArchivedSessions(): void {
  try {
    clearArchive();
  } catch (err) {
    logger.error("sessions", `failed to clear history: ${String(err)}`);
    throw err;
  }
}

export function deleteArchivedSession(id: string): boolean {
  try {
    return deleteArchived(id);
  } catch (err) {
    logger.error("sessions", `failed to delete session ${id}: ${String(err)}`);
    return false;
  }
}

export function listArchivedSessions(): SessionRecord[] {
  return listArchive();
}

function recoverCrashedSessionsIfNeeded(): void {
  if (recoveredCrashedSessions || !currentSessionExists()) return;
  recoveredCrashedSessions = true;
  try {
    const previous = readCurrentSessions();
    for (const prev of previous) {
      const recovered: SessionRecord = {
        ...normalizeSessionTotals(prev),
        endedAt: prev.endedAt ?? Date.now(),
        durationMs: (prev.endedAt ?? Date.now()) - prev.startedAt,
        status: "crashed",
      };
      archiveSession(recovered);
      logger.warn("sessions", `recovered crashed session ${recovered.id}`);
    }
  } catch (err) {
    logger.error("sessions", `failed to recover previous sessions: ${String(err)}`);
  }
  removeCurrentSession();
}

function createSessionRecord(config: Config): SessionRecord {
  const enabledProviders = (
    Object.entries(config.providers) as [ProviderId, (typeof config.providers)[ProviderId]][]
  )
    .filter(([, pc]) => pc.enabled)
    .map(([id]) => id);
  const launchHint =
    config.modelMode === "all"
      ? "all"
      : config.modelMode === "chains"
        ? "modelchain"
        : config.activeModelFallbackSlug
          ? `chain/${config.activeModelFallbackSlug}`
          : config.activeProvider;

  return {
    id: `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`,
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
  closeExpiredSessions();
  if (activeSessions.size === 0) {
    removeCurrentSession();
    stopCheckpointTimer();
    return;
  }

  for (const session of activeSessions.values()) {
    const totals = sessionTotals(session);
    session.totalRequests = totals.totalRequests;
    session.totalErrors = totals.totalErrors;
    session.durationMs = Date.now() - session.startedAt;
  }
  persistActiveSessions("checkpoint failed");
}

function closeExpiredSessions(): void {
  for (const session of Array.from(activeSessions.values())) {
    if (!shouldEndSession(session)) continue;
    logger.warn("sessions", `session ${session.id} launcher is no longer alive`);
    endSession(session.id);
  }
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

function persistActiveSessions(errorMessage: string): void {
  try {
    const sessions = Array.from(activeSessions.values());
    if (sessions.length === 0) removeCurrentSession();
    else writeCurrentSessions(sessions);
  } catch (err) {
    logger.error("sessions", `${errorMessage}: ${String(err)}`);
  }
}

function removeActiveSession(sessionId: string): void {
  const profile = sessionProfiles.get(sessionId);
  if (profile) authSessionIds.delete(profile.authToken);
  activeSessions.delete(sessionId);
  sessionProfiles.delete(sessionId);
}

function ensureCheckpointTimer(): void {
  if (checkpointTimer) return;
  checkpointTimer = setInterval(checkpoint, 10_000);
}

function stopCheckpointTimer(): void {
  if (!checkpointTimer) return;
  clearInterval(checkpointTimer);
  checkpointTimer = null;
}

function getLatestActiveSession(): SessionRecord | null {
  let latest: SessionRecord | null = null;
  for (const session of activeSessions.values()) {
    if (!latest || session.startedAt > latest.startedAt) latest = session;
  }
  return latest;
}

function withComputedTotals(session: SessionRecord): SessionRecord {
  const totals = sessionTotals(session);
  return {
    ...session,
    totalRequests: totals.totalRequests,
    totalErrors: totals.totalErrors,
    durationMs: Date.now() - session.startedAt,
  };
}

function splitCompositeLogId(id: string): { sessionId: string; entryId: string } {
  const separator = id.indexOf(":");
  if (separator === -1) return { sessionId: "", entryId: id };
  return { sessionId: id.slice(0, separator), entryId: id.slice(separator + 1) };
}

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config;
}

function normalizeRequestedModelForLog(model: string): string {
  if (model.startsWith("anthropic/")) return model.slice("anthropic/".length);
  return model;
}
