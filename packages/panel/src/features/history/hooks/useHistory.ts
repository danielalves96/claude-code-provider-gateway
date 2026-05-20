import { useCallback, useMemo, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { GatewayProviderStat, Session, SessionsResponse } from "../domain/types.js";
import { historyService } from "../services/historyService.js";
import { exportSessionJson } from "../services/sessionExport.js";

export const HISTORY_POLL_INTERVAL_MS = 5000;

export function useHistory() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [gatewayProviders, setGatewayProviders] = useState<GatewayProviderStat[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([historyService.list(), historyService.stats()])
      .then(([sessionsResponse, statsResponse]) => {
        setData(sessionsResponse);
        setGatewayProviders(statsResponse.providers);
        setIsLoading(false);
      })
      .catch(() => {
        setData(null);
        setGatewayProviders([]);
        setIsLoading(false);
      });
  }, []);

  usePolling(refresh, HISTORY_POLL_INTERVAL_MS);

  const sessions = useMemo<Session[]>(() => data?.archive ?? [], [data]);

  const totals = useMemo(
    () => ({
      requests: sessions.reduce((s, x) => s + x.totalRequests, 0),
      errors: sessions.reduce((s, x) => s + x.totalErrors, 0),
      archived: sessions.length,
    }),
    [sessions],
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

  const deleteSession = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const result = await historyService.deleteSession(id);
      setData((prev) => (prev ? { ...prev, archive: result.archive } : prev));
      setExpandedKeys((prev) => prev.filter((k) => k !== id));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const exportSession = useCallback(async (session: Session) => {
    setExportingId(session.id);
    try {
      return await exportSessionJson(session);
    } finally {
      setExportingId(null);
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
    deleteSession,
    exportSession,
    clearing,
    deletingId,
    exportingId,
    canClear: (data?.archive.length ?? 0) > 0,
    pollIntervalMs: HISTORY_POLL_INTERVAL_MS,
    isLoading,
  };
}
