// Launch-prepare: shell function calls this with a `--Provider` flag, we
// switch the active provider in config, wipe Claude's gateway-model cache,
// and return shell-evaluable `export KEY=value` lines.

import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { saveConfig } from "../config/index.js";
import type { Config, ProviderId } from "../config/schema.js";
import { CLI_FLAGS, PROVIDER_IDS } from "../config/schema.js";
import { createLaunchAuthToken, startSession } from "../runtime/sessions.js";

export interface LaunchPrepareRequest {
  flag: string;
}

export interface LaunchEnvVars {
  authToken: string;
  baseUrl: string;
  sessionId: string;
}

export interface LaunchPrepareResult {
  ok: true;
  providerId: ProviderId | null;
  fallbackSlug?: string | null;
  sessionId: string;
  shellScript: string;
  envVars: LaunchEnvVars;
}

export interface LaunchPrepareFailure {
  ok: false;
  error: string;
}

export function resolveProviderFlag(flag: string): ProviderId | null {
  if (!flag.startsWith("--")) return null;
  const target = flag.slice(2).toLowerCase();
  for (const [definedFlag, providerId] of Object.entries(CLI_FLAGS)) {
    if (definedFlag.slice(2).toLowerCase() === target) return providerId;
  }
  if ((PROVIDER_IDS as readonly string[]).includes(target)) return target as ProviderId;
  return null;
}

export function prepareLaunch(
  config: Config,
  flag: string,
): LaunchPrepareResult | LaunchPrepareFailure {
  if (isModelChainFlag(flag)) {
    if (!config.modelFallbacks.some((fallback) => fallback.enabled && fallback.models.length > 0)) {
      return { ok: false, error: "No Model Chains enabled — create one in the app first" };
    }
    config.modelMode = "chains";
    config.activeModelFallbackSlug = null;
    saveConfig(config);
    clearClaudeGatewayCache();

    const authToken = createLaunchAuthToken();
    const session = startSession(config, authToken);

    return {
      ok: true,
      providerId: null,
      fallbackSlug: null,
      sessionId: session.id,
      shellScript: buildShellExports(config, session.id, authToken),
      envVars: buildEnvVars(config, session.id, authToken),
    };
  }

  if (flag === "--all" || flag === "--a") {
    config.modelMode = "all";
    config.activeModelFallbackSlug = null;
    if (!config.providers[config.activeProvider]?.enabled) {
      const fallbackProvider = Object.keys(config.providers).find(
        (id) => config.providers[id]?.enabled,
      );
      if (fallbackProvider) config.activeProvider = fallbackProvider;
    }
    saveConfig(config);
    clearClaudeGatewayCache();

    const authToken = createLaunchAuthToken();
    const session = startSession(config, authToken);

    return {
      ok: true,
      providerId: null,
      fallbackSlug: null,
      sessionId: session.id,
      shellScript: buildShellExports(config, session.id, authToken),
      envVars: buildEnvVars(config, session.id, authToken),
    };
  }

  const providerId = resolveProviderFlag(flag) ?? resolveCustomProviderFlag(config, flag);
  if (!providerId) {
    const fallback = resolveFallbackFlag(config, flag);
    if (!fallback) {
      return { ok: false, error: `Unknown provider flag: ${flag}` };
    }
    config.activeModelFallbackSlug = fallback.slug;
    config.modelMode = "single";
    saveConfig(config);
    clearClaudeGatewayCache();

    const authToken = createLaunchAuthToken();
    const session = startSession(config, authToken);

    return {
      ok: true,
      providerId: null,
      fallbackSlug: fallback.slug,
      sessionId: session.id,
      shellScript: buildShellExports(config, session.id, authToken),
      envVars: buildEnvVars(config, session.id, authToken),
    };
  }

  const provider = config.providers[providerId];
  if (!provider) {
    return { ok: false, error: `Provider ${providerId} not configured` };
  }
  if (!provider.enabled) {
    return { ok: false, error: `Provider ${providerId} is disabled — enable it in the app first` };
  }

  config.activeProvider = providerId;
  config.modelMode = "single";
  config.activeModelFallbackSlug = null;
  saveConfig(config);
  clearClaudeGatewayCache();

  const authToken = createLaunchAuthToken();
  const session = startSession(config, authToken);

  return {
    ok: true,
    providerId,
    fallbackSlug: null,
    sessionId: session.id,
    shellScript: buildShellExports(config, session.id, authToken),
    envVars: buildEnvVars(config, session.id, authToken),
  };
}

function resolveCustomProviderFlag(config: Config, flag: string): ProviderId | null {
  if (!flag.startsWith("--")) return null;
  const target = flag.slice(2).toLowerCase();
  const match = Object.keys(config.providers).find(
    (id) => id.toLowerCase() === target && config.providers[id]?.custom,
  );
  return match ?? null;
}

function isModelChainFlag(flag: string): boolean {
  const normalized = flag.toLowerCase();
  return (
    normalized === "--modelchain" || normalized === "--modelchains" || normalized === "--chains"
  );
}

function resolveFallbackFlag(config: Config, flag: string): { slug: string } | null {
  if (!flag.startsWith("--")) return null;
  const target = flag.slice(2).toLowerCase();
  const fallback = config.modelFallbacks.find(
    (candidate) => candidate.enabled && candidate.slug.toLowerCase() === target,
  );
  if (!fallback?.models.length) return null;
  return fallback;
}

function buildEnvVars(config: Config, sessionId: string, authToken: string): LaunchEnvVars {
  return {
    authToken,
    baseUrl: `http://127.0.0.1:${config.server.proxyPort}`,
    sessionId,
  };
}

function buildShellExports(config: Config, sessionId: string, authToken: string): string {
  return [
    `export ANTHROPIC_AUTH_TOKEN=${shellQuote(authToken)}`,
    `export ANTHROPIC_BASE_URL=${shellQuote(`http://127.0.0.1:${config.server.proxyPort}`)}`,
    `export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`,
    `export CC_GATEWAY_SESSION_ID=${shellQuote(sessionId)}`,
  ].join("\n");
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function clearClaudeGatewayCache(): void {
  const cachePath = join(homedir(), ".claude", "cache", "gateway-models.json");
  try {
    if (existsSync(cachePath)) unlinkSync(cachePath);
  } catch {
    // Best-effort: stale cache will be regenerated by Claude on next launch.
  }
}
