import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { GatewayStatus, StatsResponse } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

const POLL_INTERVAL_MS = 2000;

export function useGatewayStatus() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const refresh = useCallback(() => {
    dashboardService
      .getStatus()
      .then(setStatus)
      .catch(() => {});
    dashboardService
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  usePolling(refresh, POLL_INTERVAL_MS);

  return { status, stats };
}
