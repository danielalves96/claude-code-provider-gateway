import { useCallback, useMemo, useRef, useState } from "react";
import { usePolling } from "../../../shared/hooks/usePolling.js";
import type { LaunchItem, QuickLaunch } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

const RETRY_MS = 3000;

export function useLaunchCommands() {
  const [launch, setLaunch] = useState<QuickLaunch | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(() => {
    // Skip while a request is still pending so a slow response can't land
    // after a newer one and flip state backwards (e.g. a late failure
    // restoring `error` after `launch` already loaded).
    if (inFlight.current) return;
    inFlight.current = true;
    dashboardService
      .getQuickLaunch()
      .then((value) => {
        setLaunch(value);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error("Quick Launch failed"));
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  // A single mount-time fetch left this card stuck on "Load failed" forever
  // whenever the daemon wasn't serving yet. Retry until it answers, then stop.
  usePolling(load, RETRY_MS, launch === null);

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
