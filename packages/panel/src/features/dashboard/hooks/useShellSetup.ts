import { useEffect, useState } from "react";
import type { ShellSetup } from "../domain/types.js";
import { dashboardService } from "../services/dashboardService.js";

export function useShellSetup() {
  const [setup, setSetup] = useState<ShellSetup | null>(null);

  useEffect(() => {
    dashboardService
      .getShellSetup()
      .then(setSetup)
      .catch(() => {});
  }, []);

  const refresh = () => {
    dashboardService
      .getShellSetup()
      .then(setSetup)
      .catch(() => {});
  };

  return { setup, refresh };
}
