import { useCallback, useMemo, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { GatewayProviderStat, Session, SessionsResponse } from "../domain/types.js";
import { historyService } from "../services/historyService.js";

export const HISTORY_POLL_INTERVAL_MS = 5000;

export function useHistory() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [gatewayProviders, setGatewayProviders] = useState<GatewayProviderStat[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([historyService.list(), historyService.stats()])
      .then(([sessionsResponse, statsResponse]) => {
        setData(sessionsResponse);
        setGatewayProviders(statsResponse.providers);
      })
      .catch(() => {
        setData(null);
        setGatewayProviders([]);
      });
  }, []);

  usePolling(refresh, HISTORY_POLL_INTERVAL_MS);

  const sessions = useMemo<Session[]>(() => {
    if (!data) return [];
    return data.current ? [data.current, ...data.archive] : data.archive;
  }, [data]);

  const totals = useMemo(
    () => ({
      requests: sessions.reduce((s, x) => s + x.totalRequests, 0),
      errors: sessions.reduce((s, x) => s + x.totalErrors, 0),
      archived: data?.archive.length ?? 0,
    }),
    [sessions, data],
  );

  const globalProviderRows = useMemo(
    () =>
      gatewayProviders
        .filter((provider) => provider.requests > 0)
        .sort((a, b) => b.requests - a.requests)
        .map((provider) => [provider.id, provider] as const),
    [gatewayProviders],
  );

  const clearArchive = useCallback(async () => {
    setClearing(true);
    try {
      const next = await historyService.clearArchive();
      setData(next);
      setExpandedKeys([]);
    } finally {
      setClearing(false);
    }
  }, []);

  const toggleExpanded = useCallback((id: string, expanded: boolean) => {
    setExpandedKeys((prev) => (expanded ? [...prev, id] : prev.filter((k) => k !== id)));
  }, []);

  return {
    sessions,
    totals,
    globalProviderRows,
    expandedKeys,
    toggleExpanded,
    refresh,
    clearArchive,
    clearing,
    canClear: (data?.archive.length ?? 0) > 0,
    pollIntervalMs: HISTORY_POLL_INTERVAL_MS,
  };
}
