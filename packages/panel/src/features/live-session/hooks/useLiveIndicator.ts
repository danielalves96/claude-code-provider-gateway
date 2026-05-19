import { useCallback, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import { historyService } from "../../history/services/historyService.js";

export function useLiveIndicator(): boolean {
  const [isLive, setIsLive] = useState(false);

  const check = useCallback(() => {
    historyService
      .list()
      .then(({ current }) => setIsLive(current !== null))
      .catch(() => setIsLive(false));
  }, []);

  usePolling(check, 10_000);

  return isLive;
}
