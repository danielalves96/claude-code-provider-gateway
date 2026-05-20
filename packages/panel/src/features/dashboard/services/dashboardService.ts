import { http } from "../../../shared/api/http.js";
import type {
  GatewaySessions,
  GatewayStatus,
  InstallResponse,
  LaunchCommands,
  QuickLaunch,
  ShellName,
  ShellSetup,
  StatsResponse,
} from "../domain/types.js";

export const dashboardService = {
  getStatus: () => http.get<GatewayStatus>("/status"),
  getStats: () => http.get<StatsResponse>("/stats"),
  getSessions: () => http.get<GatewaySessions>("/sessions"),
  getLaunchCommands: () => http.get<LaunchCommands>("/launch-commands"),
  getQuickLaunch: () => http.get<QuickLaunch>("/quick-launch"),
  getShellSetup: () => http.get<ShellSetup>("/shell-setup"),
  installShellSetup: (shells: ShellName[]) =>
    http.post<InstallResponse>("/shell-setup/install", { shells }),
};
