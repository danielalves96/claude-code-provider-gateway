import { useCallback, useRef, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { ShellSetup } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

const RETRY_MS = 3000;

export function useShellSetup() {
  const [setup, setSetup] = useState<ShellSetup | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    // Skip while a request is still pending so an older response can't
    // replace newer `setup` data once it lands out of order.
    if (inFlight.current) return;
    inFlight.current = true;
    dashboardService
      .getShellSetup()
      .then(setSetup)
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  // Same reason as Quick Launch: the mount-time fetch fails while the daemon
  // is still starting, and nothing retried it.
  usePolling(refresh, RETRY_MS, setup === null);

  return { setup, refresh };
}
