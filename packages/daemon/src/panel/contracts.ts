import type { Config } from "../config/schema.js";
import type { ModelInfo } from "../core/anthropic/types.js";
import type {
  SessionModelStat,
  SessionRecord,
  SessionRequestLogEntry,
  TokenSaverStats,
} from "../runtime/sessions.js";

export type GatewayStatusResponse = {
  running: boolean;
  pid: number | null;
  activeProvider: Config["activeProvider"];
  uptimeMs: number;
  proxyPort: number;
  panelPort: number;
  modelMode: Config["modelMode"];
};

export type ProviderStat = {
  requests: number;
  errors: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  lastActivityAt: number | null;
  lastError: string | null;
};

export type GatewayProviderStat = ProviderStat & {
  id: string;
  label: string;
  baseUrl?: string;
  hasKey?: boolean;
};

export type StatsResponse = {
  uptimeMs: number;
  activeProvider: Config["activeProvider"];
  modelMode: Config["modelMode"];
  providers: GatewayProviderStat[];
};

export type LaunchCommandsResponse = {
  manual: string;
  all: string;
  perProvider: Array<{ id: string; label: string; cli: string }>;
};

export type QuickLaunchResponse = Pick<LaunchCommandsResponse, "all" | "perProvider">;

export type ShellName = "zsh" | "bash" | "fish" | "powershell";

export type ShellInfo = {
  name: ShellName;
  rcPath: string;
  rcExists: boolean;
  installed: boolean;
};

export type ShellSetupResponse = {
  shells: ShellInfo[];
  currentShell: ShellName | null;
  snippets: Record<"posix" | "fish" | "powershell", string>;
  usage: string;
};

export type InstallStatus = "installed" | "updated" | "already-installed" | "error";

export type InstallResult = {
  shell: ShellName;
  status: InstallStatus;
  rcPath: string;
  error?: string;
};

export type InstallShellSetupResponse = {
  results: InstallResult[];
  setup: ShellSetupResponse;
};

export type OAuthInfo = {
  loggedIn: boolean;
  accountId?: string;
  planType?: string | null;
  expiresAt?: number | null;
};

export type ProviderInfo = {
  id: string;
  label: string;
  enabled: boolean;
  hasKey: boolean;
  keyPreview: string | null;
  baseUrl?: string;
  models?: string[];
  disabledModels?: string[];
  authType?: "api_key" | "oauth";
  oauth?: OAuthInfo;
};

export type { ModelInfo };

export type ProviderTestResult = {
  ok: boolean;
  latencyMs: number;
  modelCount?: number;
  error?: string;
};

export type OpenAIAccountOAuthStartResponse = {
  state: string;
  url: string;
};

export type OAuthStatusResponse = {
  status: "success" | "error" | "pending" | "unknown";
  error?: string;
};

export type CopilotOAuthStartResponse = {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
};

export type RoutingOption = {
  id: string;
  label: string;
  models: Array<{ id: string; display_name: string }>;
};

export type PanelConfigResponse = Config;
export type SettingsConfigResponse = Pick<Config, "server" | "webTools" | "proxy" | "tokenSavers">;
export type RoutingConfigResponse = Pick<Config, "routing" | "thinking">;

export type SessionsResponse = {
  current: SessionRecord | null;
  archive: SessionRecord[];
};

export type { SessionModelStat, SessionRecord, SessionRequestLogEntry, TokenSaverStats };
