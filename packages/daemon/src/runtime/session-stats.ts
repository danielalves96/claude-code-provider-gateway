import type {
  SessionModelStat,
  SessionProviderStat,
  SessionRecord,
  SessionRequestLogEntry,
} from "./session-types.js";

const MAX_REQUEST_LOG = 120;

export function sessionTotals(s: SessionRecord): { totalRequests: number; totalErrors: number } {
  const modelStats = Object.values(s.modelStats ?? {});
  if (modelStats.length > 0) {
    return {
      totalRequests: modelStats.reduce((a, stat) => a + stat.requests, 0),
      totalErrors: modelStats.reduce((a, stat) => a + stat.errors, 0),
    };
  }

  if ((s.requestLog ?? []).length > 0) {
    return {
      totalRequests: s.requestLog.length,
      totalErrors: s.requestLog.filter((entry) => entry.status === "error").length,
    };
  }

  const providerStats = Object.values(s.providerStats ?? {});
  return {
    totalRequests: providerStats.reduce((a, stat) => a + stat.requests, 0),
    totalErrors: providerStats.reduce((a, stat) => a + stat.errors, 0),
  };
}

export function normalizeSessionTotals(s: SessionRecord): SessionRecord {
  const totals = sessionTotals(s);
  return {
    ...s,
    totalRequests: totals.totalRequests,
    totalErrors: totals.totalErrors,
  };
}

export function applyRequestToSessionStats(
  session: SessionRecord,
  entry: SessionRequestLogEntry,
): void {
  session.requestLog = [...(session.requestLog ?? []), entry].slice(-MAX_REQUEST_LOG);
  session.modelStats = {
    ...(session.modelStats ?? {}),
    [entry.requestedModel]: nextModelStat(session.modelStats?.[entry.requestedModel], entry),
  };
  session.providerStats = {
    ...(session.providerStats ?? {}),
    [entry.providerId]: nextProviderStat(session.providerStats?.[entry.providerId], entry),
  };
  session.totalRequests += 1;
  session.totalErrors += entry.status === "error" ? 1 : 0;
}

function nextModelStat(
  existing: SessionModelStat | undefined,
  entry: SessionRequestLogEntry,
): SessionModelStat {
  const next: SessionModelStat = {
    ...(existing ?? emptyModelStat()),
    requests: (existing?.requests ?? 0) + 1,
    errors: (existing?.errors ?? 0) + (entry.status === "error" ? 1 : 0),
    inputTokens: (existing?.inputTokens ?? 0) + entry.inputTokens,
    totalLatencyMs: (existing?.totalLatencyMs ?? 0) + entry.latencyMs,
    lastActivityAt: entry.timestamp,
    lastProviderId: entry.providerId,
    lastProviderModel: entry.providerModel,
    lastError: entry.error,
  };
  next.avgLatencyMs = Math.round(next.totalLatencyMs / next.requests);
  return next;
}

function nextProviderStat(
  existing: SessionProviderStat | undefined,
  entry: SessionRequestLogEntry,
): SessionProviderStat {
  const next: SessionProviderStat = {
    ...(existing ?? emptyProviderStat()),
    requests: (existing?.requests ?? 0) + 1,
    errors: (existing?.errors ?? 0) + (entry.status === "error" ? 1 : 0),
    totalLatencyMs: (existing?.totalLatencyMs ?? 0) + entry.latencyMs,
    lastActivityAt: entry.timestamp,
    lastError: entry.error ?? existing?.lastError ?? null,
  };
  next.avgLatencyMs = Math.round(next.totalLatencyMs / next.requests);
  return next;
}

function emptyModelStat(): SessionModelStat {
  return {
    requests: 0,
    errors: 0,
    inputTokens: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    lastActivityAt: null,
    lastProviderId: null,
    lastProviderModel: null,
    lastError: null,
  };
}

function emptyProviderStat(): SessionProviderStat {
  return {
    requests: 0,
    errors: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
    lastActivityAt: null,
    lastError: null,
  };
}
