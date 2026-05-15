// GitHub Copilot OAuth — device flow, modeled after opencode's copilot adapter.
// Two tokens are involved:
//   1. GitHub OAuth access token (long-lived, stored in oauth.accessToken; starts with "gho_" or "ghu_").
//   2. Short-lived Copilot API token (stored in oauth.copilotToken; expires every ~25 minutes).
// We fetch (1) once via the device flow, then exchange it for (2) on demand.

import type { ProviderOAuthConfig } from "../../config/schema.js";

// Public client id for the GitHub Copilot CLI / IDE plugins. opencode and other
// non-Microsoft tools all use this same id; it is not a secret.
export const COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";
export const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
export const COPILOT_USER_URL = "https://api.github.com/user";
export const COPILOT_SCOPE = "read:user";

// Track the latest stable VS Code Copilot Chat extension. If GitHub starts
// rejecting older clients, bump these together.
const EDITOR_VERSION = "vscode/1.99.3";
const EDITOR_PLUGIN_VERSION = "copilot-chat/0.26.7";
const USER_AGENT = "GitHubCopilotChat/0.26.7";
const GITHUB_API_VERSION = "2025-04-01";

export interface CopilotDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CopilotGitHubToken {
  accessToken: string;
  scope?: string;
  tokenType?: string;
}

export interface CopilotApiToken {
  token: string;
  expiresAt: number;
  endpoint: string;
}

export async function startDeviceFlow(): Promise<CopilotDeviceCode> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ client_id: COPILOT_CLIENT_ID, scope: COPILOT_SCOPE }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Copilot device code request failed: HTTP ${response.status} ${text.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as Partial<CopilotDeviceCode>;
  if (!json.device_code || !json.user_code || !json.verification_uri) {
    throw new Error("Copilot device code response missing required fields");
  }
  return {
    device_code: json.device_code,
    user_code: json.user_code,
    verification_uri: json.verification_uri,
    expires_in: json.expires_in ?? 900,
    interval: json.interval ?? 5,
  };
}

export type DevicePollResult =
  | { status: "pending" }
  | { status: "slow_down"; interval: number }
  | { status: "success"; token: CopilotGitHubToken }
  | { status: "expired" }
  | { status: "denied" }
  | { status: "error"; error: string };

export async function pollDeviceFlow(deviceCode: string): Promise<DevicePollResult> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { status: "error", error: `HTTP ${response.status} ${text.slice(0, 200)}` };
  }
  const json = (await response.json()) as Record<string, unknown>;
  const error = typeof json["error"] === "string" ? json["error"] : null;
  if (error === "authorization_pending") return { status: "pending" };
  if (error === "slow_down") {
    const interval = typeof json["interval"] === "number" ? json["interval"] : 5;
    return { status: "slow_down", interval };
  }
  if (error === "expired_token") return { status: "expired" };
  if (error === "access_denied") return { status: "denied" };
  if (error) return { status: "error", error };

  const accessToken = typeof json["access_token"] === "string" ? json["access_token"] : "";
  if (!accessToken) return { status: "error", error: "no access_token in response" };
  return {
    status: "success",
    token: {
      accessToken,
      scope: typeof json["scope"] === "string" ? json["scope"] : undefined,
      tokenType: typeof json["token_type"] === "string" ? json["token_type"] : undefined,
    },
  };
}

export async function fetchGithubLogin(githubToken: string): Promise<string | undefined> {
  const response = await fetch(COPILOT_USER_URL, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) return undefined;
  const json = (await response.json()) as { login?: string };
  return typeof json.login === "string" ? json.login : undefined;
}

export async function exchangeForCopilotToken(githubToken: string): Promise<CopilotApiToken> {
  const response = await fetch(COPILOT_TOKEN_URL, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      "Editor-Version": EDITOR_VERSION,
      "Editor-Plugin-Version": EDITOR_PLUGIN_VERSION,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Copilot token exchange failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  const json = (await response.json()) as {
    token?: string;
    expires_at?: number;
    refresh_in?: number;
    endpoints?: { api?: string };
  };
  if (!json.token) throw new Error("Copilot token exchange response missing token");
  // expires_at is a unix epoch in seconds; fall back to refresh_in (seconds from now) or 25min.
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAtSec =
    typeof json.expires_at === "number" && json.expires_at > nowSec
      ? json.expires_at
      : nowSec + (typeof json.refresh_in === "number" ? json.refresh_in : 25 * 60);
  return {
    token: json.token,
    expiresAt: expiresAtSec * 1000,
    endpoint: json.endpoints?.api ?? "https://api.individual.githubcopilot.com",
  };
}

export function isCopilotLoggedIn(oauth: ProviderOAuthConfig | undefined): boolean {
  return !!oauth?.accessToken;
}

export function shouldRefreshCopilotToken(oauth: ProviderOAuthConfig | undefined): boolean {
  if (!oauth?.copilotToken || !oauth.copilotExpiresAt) return true;
  // Refresh 2 minutes before expiry to absorb skew.
  return oauth.copilotExpiresAt - Date.now() < 2 * 60 * 1000;
}

export function copilotEditorHeaders(): Record<string, string> {
  return {
    "Editor-Version": EDITOR_VERSION,
    "Editor-Plugin-Version": EDITOR_PLUGIN_VERSION,
    "Copilot-Integration-Id": "vscode-chat",
    "User-Agent": USER_AGENT,
    // Required by /v1/messages and harmless for /chat/completions. Without
    // this header GitHub may rate-limit aggressively or reject the request.
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    // GitHub uses this for billing/rate-limit accounting. "agent" matches the
    // Claude Code use case (multi-turn tool-calling agent).
    "X-Initiator": "agent",
    // Opt into the "always-on" preview-features header that the VS Code extension sends.
    "Openai-Intent": "conversation-edits",
  };
}
