import { useMemo, useState } from "react";
import { useGatewayStatus } from "./useGatewayStatus.js";
import { useLaunchCommands } from "./useLaunchCommands.js";
import { useShellSetup } from "./useShellSetup.js";

const DISMISSED_SHELL_SETUP_KEY = "cc-provider-gtw:shell-setup-dismissed";

export function useDashboardPage() {
  const gateway = useGatewayStatus();
  const launch = useLaunchCommands();
  const shellSetup = useShellSetup();
  const [setupDismissed, setSetupDismissed] = useState(
    () => window.localStorage.getItem(DISMISSED_SHELL_SETUP_KEY) === "true",
  );

  const hasTerminalConfigured = useMemo(
    () => shellSetup.setup?.shells.some((shell) => shell.installed) ?? false,
    [shellSetup.setup],
  );

  const shouldShowShellSetup =
    !!shellSetup.setup && !!gateway.status && !setupDismissed && !hasTerminalConfigured;

  function dismissShellSetup(): void {
    window.localStorage.setItem(DISMISSED_SHELL_SETUP_KEY, "true");
    setSetupDismissed(true);
  }

  return {
    status: gateway.status,
    stats: gateway.stats,
    isLoading: gateway.isLoading,
    launchItems: launch.items,
    launchError: launch.error,
    shellSetup: shellSetup.setup,
    refreshShellSetup: shellSetup.refresh,
    hasTerminalConfigured,
    shouldShowShellSetup,
    dismissShellSetup,
  };
}
