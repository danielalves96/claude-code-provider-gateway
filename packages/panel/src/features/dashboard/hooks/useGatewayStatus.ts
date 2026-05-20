import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { GatewaySessions, GatewayStatus, StatsResponse } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

const POLL_INTERVAL_MS = 5000;

export function useGatewayStatus() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [sessions, setSessions] = useState<GatewaySessions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([
      dashboardService.getStatus(),
      dashboardService.getStats(),
      dashboardService.getSessions(),
    ])
      .then(([s, st, sessionResponse]) => {
        setStatus(s);
        setStats(st);
        setSessions(sessionResponse);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  usePolling(refresh, POLL_INTERVAL_MS);

  return { status, stats, sessions, isLoading };
}
