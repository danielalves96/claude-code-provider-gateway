import {
  CheckCircleFilled,
  CopyOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { App, Button, Card, Empty, Flex, Space, Tag, Tooltip, Typography, theme } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useCopyToClipboard } from "../../../shared/hooks/useCopyToClipboard.js";
import { dashboardService } from "../dashboardService.js";
import type { InstallResult, LaunchItem, ShellInfo, ShellName, ShellSetup } from "../types.js";

const { Text, Paragraph } = Typography;

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

  const allInstalled = setup.shells.every((s) => s.installed || !s.rcExists);
  const installableShells = setup.shells.filter((s) => !s.installed);

  return (
    <Card
      title="Terminal shortcut"
      extra={
        <Space>
          <HeaderSummary shells={setup.shells} />
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
          <Flex wrap gap={token.paddingXS} align="center">
            {setup.shells.map((shell) => (
              <ShellInstallButton
                key={shell.name}
                shell={shell}
                busy={installingShell === shell.name}
                disabledByOthers={installingShell !== null && installingShell !== shell.name}
                onClick={() => handleInstall([shell.name], shell.name)}
              />
            ))}
            {installableShells.length > 1 && !allInstalled && (
              <Button
                type="primary"
                icon={installingShell === "all" ? <LoadingOutlined /> : <DownloadOutlined />}
                loading={installingShell === "all"}
                disabled={installingShell !== null && installingShell !== "all"}
                onClick={() =>
                  handleInstall(
                    installableShells.map((s) => s.name),
                    "all",
                  )
                }
              >
                Add to all
              </Button>
            )}
          </Flex>

          <ManualOneLiner setup={setup} panelPort={panelPort} copiedKey={copiedKey} onCopy={copy} />
        </Flex>
      )}
    </Card>
  );
}

interface QuickLaunchCardProps {
  items: LaunchItem[];
  error?: Error | null;
}

export function QuickLaunchCard({ items, error }: QuickLaunchCardProps) {
  const { copiedKey, copy } = useCopyToClipboard();

  return (
    <Card title="Quick Launch">
      <AvailableProviders items={items} error={error} onCopy={copy} copiedKey={copiedKey} />
    </Card>
  );
}

function HeaderSummary({ shells }: { shells: ShellInfo[] }) {
  const installed = shells.filter((s) => s.installed);
  if (installed.length === 0) {
    return <Tag>Not installed</Tag>;
  }
  return (
    <Space size={4}>
      <CheckCircleFilled style={{ color: "#52c41a" }} />
      <Text type="secondary">
        Installed in {installed.map((s) => SHELL_DISPLAY_NAMES[s.name]).join(", ")}
      </Text>
    </Space>
  );
}

function AvailableProviders({
  items,
  error,
  copiedKey,
  onCopy,
}: {
  items: LaunchItem[];
  error?: Error | null;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const { token } = theme.useToken();
  if (error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`Quick Launch unavailable: ${error.message}`}
        style={{ margin: 0 }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No providers enabled yet — enable one in the Providers tab"
        style={{ margin: 0 }}
      />
    );
  }

  return (
    <Flex vertical gap={token.paddingXS}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Available in your terminal:
      </Text>
      <Flex wrap gap={token.paddingXS}>
        {items.map((item) => (
          <Tooltip
            key={item.id}
            title={copiedKey === item.id ? "Copied!" : `Click to copy: ${item.cmd}`}
          >
            <Tag
              color={copiedKey === item.id ? "success" : "processing"}
              style={{ fontFamily: "monospace", cursor: "pointer", margin: 0 }}
              onClick={() => onCopy(item.id, item.cmd)}
            >
              {item.badge}
            </Tag>
          </Tooltip>
        ))}
      </Flex>
    </Flex>
  );
}

const SHELL_DISPLAY_NAMES: Record<ShellName, string> = {
  zsh: "zsh",
  bash: "bash",
  fish: "fish",
  powershell: "PowerShell",
};

function ShellInstallButton({
  shell,
  busy,
  disabledByOthers,
  onClick,
}: {
  shell: ShellInfo;
  busy: boolean;
  disabledByOthers: boolean;
  onClick: () => void;
}) {
  const displayName = SHELL_DISPLAY_NAMES[shell.name];

  if (shell.installed) {
    return (
      <Tooltip title={`Already in ${shell.rcPath}`}>
        <Button icon={<CheckCircleFilled style={{ color: "#52c41a" }} />} disabled>
          {displayName}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`Writes to ${shell.rcPath}`}>
      <Button
        icon={busy ? <LoadingOutlined /> : <DownloadOutlined />}
        loading={busy}
        disabled={disabledByOthers}
        onClick={onClick}
      >
        Add to {displayName}
      </Button>
    </Tooltip>
  );
}

function ManualOneLiner({
  setup,
  panelPort,
  copiedKey,
  onCopy,
}: {
  setup: ShellSetup;
  panelPort: number;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const { token } = theme.useToken();
  // Default to the user's current shell if detected, otherwise zsh.
  const [pickedShell, setPickedShell] = useState<ShellName>(
    setup.currentShell ?? setup.shells[0]?.name ?? "bash",
  );
  const pickedInfo = setup.shells.find((s) => s.name === pickedShell);

  const oneLiner = useMemo(() => {
    if (pickedShell === "powershell") {
      return `Invoke-RestMethod http://127.0.0.1:${panelPort}/api/shell-setup/snippet/powershell | Add-Content $PROFILE`;
    }
    return `curl -fsS http://127.0.0.1:${panelPort}/api/shell-setup/snippet/${pickedShell} >> ${pickedInfo?.rcPath ?? `~/.${pickedShell}rc`}`;
  }, [panelPort, pickedShell, pickedInfo?.rcPath]);

  return (
    <Flex vertical gap={token.paddingXS}>
      <Flex justify="space-between" align="center">
        <Text type="secondary" style={{ fontSize: 12 }}>
          Or paste this in any terminal:
        </Text>
        <Space size={4}>
          {setup.shells.map((s) => (
            <Tag
              key={s.name}
              color={pickedShell === s.name ? "blue" : undefined}
              style={{ cursor: "pointer", margin: 0 }}
              onClick={() => setPickedShell(s.name)}
            >
              {SHELL_DISPLAY_NAMES[s.name]}
            </Tag>
          ))}
        </Space>
      </Flex>
      <Flex
        align="center"
        gap={token.paddingXS}
        style={{
          background: token.colorFillTertiary,
          padding: `${token.paddingXS}px ${token.paddingSM}px`,
          borderRadius: token.borderRadius,
        }}
      >
        <Paragraph
          code
          copyable={false}
          style={{
            flex: 1,
            margin: 0,
            fontSize: 12,
            overflow: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {oneLiner}
        </Paragraph>
        <Button
          size="small"
          icon={<CopyOutlined />}
          type={copiedKey === "oneliner" ? "primary" : "default"}
          onClick={() => onCopy("oneliner", oneLiner)}
        >
          {copiedKey === "oneliner" ? "Copied" : "Copy"}
        </Button>
      </Flex>
    </Flex>
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
