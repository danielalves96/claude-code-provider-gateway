import type { ProviderId } from "../config/schema.js";

export interface SessionModelStat {
  requests: number;
  errors: number;
  inputTokens: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastActivityAt: number | null;
  // Strings (not strictly ProviderId) so synthetic flows like "anthropic_native" fit cleanly.
  lastProviderId: string | null;
  lastProviderModel: string | null;
  lastError: string | null;
}

export interface SessionProviderStat {
  requests: number;
  errors: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  lastActivityAt: number | null;
  lastError: string | null;
}

export interface SessionRequestLogEntry {
  id: string;
  timestamp: number;
  requestedModel: string;
  providerId: string;
  providerModel: string;
  inputTokens: number;
  latencyMs: number;
  status: "ok" | "error";
  error: string | null;
  prompt?: string;
  response?: string;
  tokenSavers?: TokenSaverStats;
}

export interface TokenSaverStats {
  rtkBytesBefore: number;
  rtkBytesAfter: number;
  rtkHits: number;
  rtkFilters: string[];
  cavemanLevel: "lite" | "full" | "ultra" | null;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  status: "running" | "completed" | "crashed";
  modelMode: "single" | "all";
  activeProvider: ProviderId;
  launchHint: string;
  enabledProviders: ProviderId[];
  providerStats: Record<string, SessionProviderStat>;
  modelStats: Record<string, SessionModelStat>;
  requestLog: SessionRequestLogEntry[];
  totalRequests: number;
  totalErrors: number;
  lastHeartbeatAt?: number;
  watchedPid?: number;
}
