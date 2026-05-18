import { useMemo, useState } from "react";
import { getTopModelInfo, getTopProviderInfo } from "../domain/metrics.js";
import { useHistory } from "./useHistory.js";

export function useHistoryPage() {
  const history = useHistory();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const topProviderInfo = useMemo(() => getTopProviderInfo(history.sessions), [history.sessions]);
  const topModelInfo = useMemo(() => getTopModelInfo(history.sessions), [history.sessions]);

  async function confirmClearArchive(): Promise<void> {
    await history.clearArchive();
    setConfirmOpen(false);
  }

  function openClearConfirm(): void {
    setConfirmOpen(true);
  }

  function closeClearConfirm(): void {
    setConfirmOpen(false);
  }

  return {
    ...history,
    confirmOpen,
    topProviderInfo,
    topModelInfo,
    openClearConfirm,
    closeClearConfirm,
    confirmClearArchive,
  };
}
