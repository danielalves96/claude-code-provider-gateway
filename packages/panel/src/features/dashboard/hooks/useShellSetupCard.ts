import type { message } from "antd";
import { useEffect, useState } from "react";
import { useCopyToClipboard } from "../../../shared/hooks/useCopyToClipboard.js";
import type { InstallResult, ShellName } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

type MessageApi = ReturnType<typeof message.useMessage>[0];

interface UseShellSetupCardOptions {
  defaultOpen: boolean;
  onRefresh: () => void;
  message: MessageApi;
}

export function useShellSetupCard({ defaultOpen, onRefresh, message }: UseShellSetupCardOptions) {
  const { copiedKey, copy } = useCopyToClipboard();
  const [installingShell, setInstallingShell] = useState<ShellName | "all" | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  async function install(shells: ShellName[], key: ShellName | "all"): Promise<void> {
    setInstallingShell(key);
    try {
      const { results } = await dashboardService.installShellSetup(shells);
      announceResults(results, message);
      onRefresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstallingShell(null);
    }
  }

  function toggleOpen(): void {
    setOpen((value) => !value);
  }

  return {
    copiedKey,
    copy,
    installingShell,
    open,
    install,
    toggleOpen,
  };
}

function announceResults(results: InstallResult[], message: MessageApi): void {
  const installed = results.filter((result) => result.status === "installed");
  const updated = results.filter((result) => result.status === "updated");
  const already = results.filter((result) => result.status === "already-installed");
  const errors = results.filter((result) => result.status === "error");

  if (installed.length > 0) {
    message.success(
      `Added to ${installed.map((result) => result.shell).join(", ")} — open a new terminal to use it`,
    );
  }
  if (updated.length > 0) {
    message.success(
      `Updated ${updated.map((result) => result.shell).join(", ")} — open a new terminal to pick up the new snippet`,
    );
  }
  if (already.length > 0 && installed.length === 0 && updated.length === 0) {
    message.info(`Already up to date in ${already.map((result) => result.shell).join(", ")}`);
  }
  for (const error of errors) {
    message.error(`${error.shell}: ${error.error ?? "unknown error"}`);
  }
}
