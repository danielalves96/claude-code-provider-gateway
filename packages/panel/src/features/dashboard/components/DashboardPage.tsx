import { useMemo, useState } from "react";
import { Flex, theme } from "antd";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useGatewayStatus } from "../hooks/useGatewayStatus.js";
import { useLaunchCommands } from "../hooks/useLaunchCommands.js";
import { useLiveLogs } from "../hooks/useLiveLogs.js";
import { useShellSetup } from "../hooks/useShellSetup.js";
import { StatusOverview } from "./StatusOverview.js";
import { EnabledProvidersCard } from "./EnabledProvidersCard.js";
import { QuickLaunchCard, ShellSetupCard } from "./ShellSetupCard.js";
import { LiveLogsPanel } from "./LiveLogsPanel.js";

const DISMISSED_SHELL_SETUP_KEY = "cc-provider-gtw:shell-setup-dismissed";

export default function DashboardPage() {
  const { token } = theme.useToken();
  const { status, stats } = useGatewayStatus();
  const { items, error: launchError } = useLaunchCommands();
  const { setup, refresh } = useShellSetup();
  const { logs, paused, togglePaused, clear } = useLiveLogs();
  const [setupDismissed, setSetupDismissed] = useState(
    () => window.localStorage.getItem(DISMISSED_SHELL_SETUP_KEY) === "true",
  );

  const hasTerminalConfigured = useMemo(
    () => setup?.shells.some(shell => shell.installed) ?? false,
    [setup],
  );

  const shellSetupCard = setup && status && !setupDismissed ? (
    <ShellSetupCard
      setup={setup}
      panelPort={status.panelPort ?? 6767}
      defaultOpen={!hasTerminalConfigured}
      canDismiss={hasTerminalConfigured}
      onRefresh={refresh}
      onDismiss={() => {
        window.localStorage.setItem(DISMISSED_SHELL_SETUP_KEY, "true");
        setSetupDismissed(true);
      }}
    />
  ) : null;

  return (
    <Flex vertical gap={token.paddingLG}>
      <PageHeader title="Dashboard" />
      <StatusOverview status={status} />
      <EnabledProvidersCard stats={stats} />
      {!hasTerminalConfigured && shellSetupCard}
      <QuickLaunchCard items={items} error={launchError} />
      {hasTerminalConfigured && shellSetupCard}
      <LiveLogsPanel
        logs={logs}
        paused={paused}
        onTogglePaused={togglePaused}
        onClear={clear}
      />
    </Flex>
  );
}
