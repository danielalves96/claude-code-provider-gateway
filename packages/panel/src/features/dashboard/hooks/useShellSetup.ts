import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { ShellSetup } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

const RETRY_MS = 3000;

export function useShellSetup() {
  const [setup, setSetup] = useState<ShellSetup | null>(null);

  const refresh = useCallback(() => {
    dashboardService
      .getShellSetup()
      .then(setSetup)
      .catch(() => {});
  }, []);

  // Same reason as Quick Launch: the mount-time fetch fails while the daemon
  // is still starting, and nothing retried it.
  usePolling(refresh, RETRY_MS, setup === null);

  return { setup, refresh };
}
