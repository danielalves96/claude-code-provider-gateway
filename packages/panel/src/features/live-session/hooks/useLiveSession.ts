import { useCallback, useRef, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { Session } from "../../history/domain/types.js";
import { historyService } from "../../history/services/historyService.js";

const POLL_INTERVAL_MS = 5000;

export function useLiveSession() {
  const [current, setCurrent] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const latestRequestIdRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++latestRequestIdRef.current;
    historyService
      .list()
      .then(({ current: c }) => {
        if (requestId === latestRequestIdRef.current) {
          setCurrent(c);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (requestId === latestRequestIdRef.current) {
          // Preserve last known session on error; only stop loading indicator
          setIsLoading(false);
        }
      });
  }, []);

  usePolling(refresh, POLL_INTERVAL_MS);

  return { session: current, isLoading, refresh, pollIntervalMs: POLL_INTERVAL_MS };
}
