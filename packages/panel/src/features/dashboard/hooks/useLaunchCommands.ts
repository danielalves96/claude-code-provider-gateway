import { useEffect, useMemo, useState } from "react";
import type { LaunchItem, QuickLaunch } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

export function useLaunchCommands() {
  const [launch, setLaunch] = useState<QuickLaunch | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    dashboardService
      .getQuickLaunch()
      .then((value) => {
        setLaunch(value);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error("Quick Launch failed"));
      });
  }, []);

  const items: LaunchItem[] = useMemo(() => {
    if (!launch) return [];
    const providerItems = launch.perProvider
      .filter((p) => !p.id.startsWith("chain:"))
      .map((p) => ({
        id: p.id,
        label: p.label,
        badge: flagFromCommand(p.cli),
        cmd: p.cli,
      }));
    const chainItems = launch.perProvider
      .filter((p) => p.id.startsWith("chain:"))
      .map((p) => ({
        id: p.id,
        label: p.label,
        badge: flagFromCommand(p.cli),
        cmd: p.cli,
      }));
    return [
      { id: "all", label: "All providers", badge: "--all", cmd: launch.all },
      ...providerItems,
      ...(chainItems.length >= 2
        ? [
            {
              id: "model-chains",
              label: "All Model Chains",
              badge: "--ModelChain",
              cmd: launch.modelChains,
            },
          ]
        : []),
      ...chainItems,
    ];
  }, [launch]);

  return { launch, items, error };
}

function flagFromCommand(command: string): string {
  return command.split(/\s+/).find((part) => part.startsWith("--")) ?? command;
}
