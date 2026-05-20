import { useMemo, useState } from "react";
import type {
  GatewayProviderStat,
  SessionRecord,
} from "../../../../../daemon/src/panel/contracts.js";
import { useGatewayStatus } from "./useGatewayStatus.js";
import { useLaunchCommands } from "./useLaunchCommands.js";
import { useShellSetup } from "./useShellSetup.js";

function computeTopModel(sessions: SessionRecord[]): string | null {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    for (const [model, stat] of Object.entries(session.modelStats ?? {})) {
      totals.set(model, (totals.get(model) ?? 0) + stat.requests);
    }
  }
  if (totals.size === 0) return null;
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const segment = top.includes("/") ? top.split("/").at(-1)! : top;
  return segment.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

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

  const allSessions = useMemo(
    () => [...(gateway.sessions?.currentSessions ?? []), ...(gateway.sessions?.archive ?? [])],
    [gateway.sessions?.currentSessions, gateway.sessions?.archive],
  );

  const topModel = useMemo(() => computeTopModel(allSessions), [allSessions]);

  const topProviders = useMemo(
    () =>
      gateway.stats && gateway.sessions
        ? buildTopProviders(gateway.stats.providers, gateway.sessions.archive ?? [])
        : null,
    [gateway.stats, gateway.sessions],
  );

  function dismissShellSetup(): void {
    window.localStorage.setItem(DISMISSED_SHELL_SETUP_KEY, "true");
    setSetupDismissed(true);
  }

  return {
    status: gateway.status,
    stats: topProviders,
    topModel,
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

function buildTopProviders(
  enabledProviders: GatewayProviderStat[],
  archivedSessions: SessionRecord[],
) {
  const historyStats = new Map<string, GatewayProviderStat>();

  for (const provider of enabledProviders) {
    historyStats.set(provider.id, {
      ...provider,
      requests: 0,
      errors: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
      lastActivityAt: null,
      lastError: null,
    });
  }

  for (const session of archivedSessions) {
    for (const [id, stat] of Object.entries(session.providerStats ?? {})) {
      const provider = historyStats.get(id);
      if (!provider) continue;

      provider.requests += stat.requests;
      provider.errors += stat.errors;
      provider.totalLatencyMs += stat.totalLatencyMs;
      const prevActivity = provider.lastActivityAt ?? 0;
      const statActivity = stat.lastActivityAt ?? 0;
      provider.lastActivityAt = Math.max(prevActivity, statActivity) || null;
      if (stat.lastError != null && statActivity >= prevActivity) {
        provider.lastError = stat.lastError;
      }
    }
  }

  const providers = Array.from(historyStats.values())
    .map((provider) => ({
      ...provider,
      avgLatencyMs:
        provider.requests > 0 ? Math.round(provider.totalLatencyMs / provider.requests) : 0,
    }))
    .sort((a, b) => {
      if (b.requests !== a.requests) return b.requests - a.requests;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 3);

  return { providers };
}
