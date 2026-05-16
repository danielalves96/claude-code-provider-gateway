import { App, Button, Card, Flex, Space, theme } from "antd";
import { useEffect, useState } from "react";
import { useCopyToClipboard } from "../../../shared/hooks/useCopyToClipboard.js";
import { dashboardService } from "../dashboardService.js";
import type { InstallResult, ShellName, ShellSetup } from "../types.js";
import { ShellInstallActions, ShellInstallSummary } from "./ShellInstallActions.js";
import { ShellSetupManualCommand } from "./ShellSetupManualCommand.js";

interface ShellSetupCardProps {
  setup: ShellSetup;
  panelPort: number;
  defaultOpen: boolean;
  canDismiss: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function ShellSetupCard({
  setup,
  panelPort,
  defaultOpen,
  canDismiss,
  onRefresh,
  onDismiss,
}: ShellSetupCardProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { copiedKey, copy } = useCopyToClipboard();
  const [installingShell, setInstallingShell] = useState<ShellName | "all" | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  const handleInstall = async (shells: ShellName[], key: ShellName | "all") => {
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
  };

  return (
    <Card
      title="Terminal shortcut"
      extra={
        <Space>
          <ShellInstallSummary shells={setup.shells} />
          {canDismiss && (
            <Button type="text" size="small" onClick={onDismiss}>
              Dismiss configuration message
            </Button>
          )}
          <Button type="text" size="small" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Configure"}
          </Button>
        </Space>
      }
      styles={{
        header: { borderBottom: open ? undefined : 0 },
        body: { display: open ? undefined : "none" },
      }}
    >
      {open && (
        <Flex vertical gap={token.paddingMD}>
          <ShellInstallActions
            shells={setup.shells}
            installingShell={installingShell}
            onInstall={handleInstall}
          />
          <ShellSetupManualCommand
            setup={setup}
            panelPort={panelPort}
            copiedKey={copiedKey}
            onCopy={copy}
          />
        </Flex>
      )}
    </Card>
  );
}

function announceResults(
  results: InstallResult[],
  message: ReturnType<typeof App.useApp>["message"],
): void {
  const installed = results.filter((r) => r.status === "installed");
  const updated = results.filter((r) => r.status === "updated");
  const already = results.filter((r) => r.status === "already-installed");
  const errors = results.filter((r) => r.status === "error");

  if (installed.length > 0) {
    message.success(
      `Added to ${installed.map((r) => r.shell).join(", ")} — open a new terminal to use it`,
    );
  }
  if (updated.length > 0) {
    message.success(
      `Updated ${updated.map((r) => r.shell).join(", ")} — open a new terminal to pick up the new snippet`,
    );
  }
  if (already.length > 0 && installed.length === 0 && updated.length === 0) {
    message.info(`Already up to date in ${already.map((r) => r.shell).join(", ")}`);
  }
  for (const e of errors) {
    message.error(`${e.shell}: ${e.error ?? "unknown error"}`);
  }
}
