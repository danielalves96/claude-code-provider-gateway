import type {
  GatewayProviderStat,
  GatewayStatusResponse,
  InstallResult,
  InstallShellSetupResponse,
  LaunchCommandsResponse,
  QuickLaunchResponse,
  ShellInfo,
  ShellName,
  ShellSetupResponse,
} from "../../../../../daemon/src/panel/contracts.js";

export type GatewayStatus = GatewayStatusResponse;
export type ProviderStat = GatewayProviderStat;
export type StatsResponse = {
  providers: GatewayProviderStat[];
};
export type LaunchCommands = LaunchCommandsResponse;
export type QuickLaunch = QuickLaunchResponse;

export interface LaunchItem {
  id: string;
  label: string;
  badge: string;
  cmd: string;
}

export type { InstallResult, ShellInfo, ShellName };
export type ShellSetup = ShellSetupResponse;
export type InstallResponse = InstallShellSetupResponse;
