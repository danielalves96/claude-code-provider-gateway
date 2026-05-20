import { formatRelative } from "../../../shared/utils/time.js";
import type { ProviderStat } from "../domain/types.js";

export function useProviderStatCard(provider: ProviderStat) {
  return {
    errorRate: getErrorRate(provider),
    lastActivity: provider.lastActivityAt ? formatRelative(provider.lastActivityAt) : "never",
    averageLatency: provider.requests > 0 ? `${provider.avgLatencyMs}ms` : "—",
    lastError: formatLastError(provider.lastError),
    hasErrors: provider.errors > 0,
  };
}

function getErrorRate(provider: ProviderStat): number {
  if (provider.requests === 0) return 0;
  return Math.round((provider.errors / provider.requests) * 100);
}

function formatLastError(error: string | null): string | null {
  if (!error) return null;
  if (error.length <= 30) return error;
  return `${error.slice(0, 30)}…`;
}
