import { useEffect, useMemo, useState } from "react";
import { dashboardService } from "../dashboardService.js";
import type { LaunchItem, QuickLaunch } from "../types.js";

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
    return [
      { id: "all", label: "All providers", badge: "--all", cmd: launch.all },
      ...launch.perProvider.map((p) => ({
        id: p.id,
        label: p.label,
        badge: `--${p.id.replace(/_/g, "")}`,
        cmd: p.cli,
      })),
    ];
  }, [launch]);

  return { launch, items, error };
}
