import { CodeOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Space, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { useCopyToClipboard } from "../../../shared/hooks/useCopyToClipboard.js";
import { dashboardService } from "../dashboardService.js";
import type { InstallResult, ShellName, ShellSetup } from "../types.js";
import { ShellInstallActions, ShellInstallSummary } from "./ShellInstallActions.js";
import { ShellSetupManualCommand } from "./ShellSetupManualCommand.js";

const { Text } = Typography;

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
      style={{
        borderColor: token.colorBorderSecondary,
        boxShadow: token.boxShadow,
      }}
      styles={{
        header: {
          borderBottom: open ? `1px solid ${token.colorBorderSecondary}` : 0,
          padding: `${token.padding}px ${token.paddingLG}px`,
        },
        body: {
          display: open ? undefined : "none",
          padding: token.paddingLG,
        },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <div
            style={{
              color: token.colorInfo,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${token.colorInfo}20 0%, ${token.colorBgContainer} 100%)`,
              border: `1px solid ${token.colorInfo}30`,
              boxShadow: `0 0 10px ${token.colorInfo}10`,
            }}
          >
            <CodeOutlined />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            Terminal Integration
          </Text>
        </Flex>
      }
      extra={
        <Space>
          <ShellInstallSummary shells={setup.shells} />
          {canDismiss && (
            <Button type="text" size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          <Button type="primary" ghost size="small" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide Details" : "Configure"}
          </Button>
        </Space>
      }
    >
      {open && (
        <Flex vertical gap={token.paddingLG}>
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
