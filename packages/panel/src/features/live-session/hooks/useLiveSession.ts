import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { Session } from "../../history/domain/types.js";
import { historyService } from "../../history/services/historyService.js";

const POLL_INTERVAL_MS = 5000;

export function useLiveSession() {
  const [current, setCurrent] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    historyService
      .list()
      .then(({ current: c }) => {
        setCurrent(c);
        setIsLoading(false);
      })
      .catch(() => {
        setCurrent(null);
        setIsLoading(false);
      });
  }, []);

  usePolling(refresh, POLL_INTERVAL_MS);

  return { session: current, isLoading, refresh, pollIntervalMs: POLL_INTERVAL_MS };
}
