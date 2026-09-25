import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { GatewayStatus } from "../../dashboard/domain/types.js";
import { dashboardService } from "../../dashboard/services/dashboardService.js";
import { daemonControl } from "../services/daemonControl.js";

export type DaemonState = "running" | "offline" | "unknown";

const POLL_MS = 5000;

export function useDaemonStatus() {
  const [state, setState] = useState<DaemonState>("unknown");
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await dashboardService.getStatus();
      setStatus(s);
      setState(s.running ? "running" : "offline");
      setError(null);
    } catch {
      setStatus(null);
      setState("offline");
      // HTTP is down. Under Tauri the supervisor knows the real reason the
      // sidecar isn't serving; prefer it over the webview's generic message.
      const native = await daemonControl.nativeStatus();
      setError(native?.lastError ?? null);
    }
  }, []);

  usePolling(refresh, POLL_MS, polling);

  return {
    state,
    status,
    error,
    refresh,
    pause: () => setPolling(false),
    resume: () => setPolling(true),
  };
}
