import { useCallback, useRef, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import { historyService } from "../../history/services/historyService.js";

export function useLiveIndicator(): boolean {
  const [isLive, setIsLive] = useState(false);
  const latestRequestIdRef = useRef(0);

  const check = useCallback(() => {
    const requestId = ++latestRequestIdRef.current;
    historyService
      .list()
      .then(({ current }) => {
        if (requestId === latestRequestIdRef.current) {
          setIsLive(current !== null);
        }
      })
      .catch(() => {
        // Preserve previous isLive on error to avoid false-negative flicker
      });
  }, []);

  usePolling(check, 10_000);

  return isLive;
}
