import { useCallback, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling.js";
import { dashboardService } from "../dashboard/dashboardService.js";
import type { GatewayStatus } from "../dashboard/types.js";

export type DaemonState = "running" | "offline" | "unknown";

const POLL_MS = 5000;

export function useDaemonStatus() {
  const [state, setState] = useState<DaemonState>("unknown");
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [polling, setPolling] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await dashboardService.getStatus();
      setStatus(s);
      setState(s.running ? "running" : "offline");
    } catch {
      setStatus(null);
      setState("offline");
    }
  }, []);

  usePolling(refresh, POLL_MS, polling);

  return {
    state,
    status,
    refresh,
    pause: () => setPolling(false),
    resume: () => setPolling(true),
  };
}
