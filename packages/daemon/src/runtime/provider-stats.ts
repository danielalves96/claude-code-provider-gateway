// Per-provider runtime stats. In-memory, reset on daemon restart.

import type { ProviderId } from "../config/schema.js";

// Stats accept any string identifier so we can record synthetic flows like the
// native Claude passthrough ("anthropic_native") that aren't configured providers.
type StatsKey = ProviderId | string;

export interface ProviderStats {
  requests: number;
  errors: number;
  totalLatencyMs: number;
  lastActivityAt: number | null; // ms since epoch
  lastError: string | null;
}

const stats = new Map<StatsKey, ProviderStats>();
const startedAt = Date.now();

function ensure(id: StatsKey): ProviderStats {
  let s = stats.get(id);
  if (!s) {
    s = { requests: 0, errors: 0, totalLatencyMs: 0, lastActivityAt: null, lastError: null };
    stats.set(id, s);
  }
  return s;
}

export function recordRequest(id: StatsKey, latencyMs: number, error: string | null) {
  const s = ensure(id);
  s.requests++;
  s.totalLatencyMs += latencyMs;
  s.lastActivityAt = Date.now();
  if (error) {
    s.errors++;
    s.lastError = error;
  }
}

export function getStats(): Record<string, ProviderStats & { avgLatencyMs: number }> {
  const out: Record<string, ProviderStats & { avgLatencyMs: number }> = {};
  for (const [id, s] of stats) {
    out[id] = {
      ...s,
      avgLatencyMs: s.requests > 0 ? Math.round(s.totalLatencyMs / s.requests) : 0,
    };
  }
  return out;
}

export function getUptimeMs(): number {
  return Date.now() - startedAt;
}
