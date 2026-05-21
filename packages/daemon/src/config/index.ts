import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { writePrivateFile } from "../core/files/private-file.js";
import { getConfigPath, getMasterKeyPath, getSecretsPath } from "./paths.js";
import type { BuiltInProviderId, Config, ProviderConfig } from "./schema.js";
import { OAUTH_PROVIDER_IDS, PROVIDER_DEFAULTS, PROVIDER_IDS } from "./schema.js";
import { extractSecretsToStore, hydrateSecretsFromStore } from "./secrets/config-splitter.js";
import { EncryptedFileSecretStore } from "./secrets/encrypted-file-store.js";
import { resolveMasterKey } from "./secrets/master-key.js";
import type { SecretStore } from "./secrets/store.js";
import { SECRET_KEYS } from "./secrets/store.js";
import { normalizeConfig } from "./validation.js";

export {
  getConfigDir,
  getConfigPath,
  getCurrentSessionPath,
  getLogPath,
  getMasterKeyPath,
  getPidPath,
  getProviderLogoDir,
  getSecretsPath,
  getSessionArchivePath,
} from "./paths.js";

let cachedSecretStore: SecretStore | null = null;

export function getSecretStore(): SecretStore {
  if (cachedSecretStore) return cachedSecretStore;
  const { key } = resolveMasterKey(getMasterKeyPath());
  cachedSecretStore = new EncryptedFileSecretStore(getSecretsPath(), key);
  return cachedSecretStore;
}

function buildDefaultProviderConfig(id: BuiltInProviderId): ProviderConfig {
  const isOAuth = OAUTH_PROVIDER_IDS.has(id);
  return {
    enabled: false,
    apiKey: "",
    authType: isOAuth ? "oauth" : "api_key",
    oauth: isOAuth ? {} : undefined,
    baseUrl: PROVIDER_DEFAULTS[id]?.baseUrl,
    rateLimit: 0,
    rateWindow: 0,
    maxConcurrency: 0,
  };
}

function buildDefaultProviders(): Record<string, ProviderConfig> {
  return PROVIDER_IDS.reduce(
    (providers, id) => {
      providers[id] = buildDefaultProviderConfig(id);
      return providers;
    },
    {} as Record<string, ProviderConfig>,
  );
}

export function buildDefaultConfig(): Config {
  return {
    server: {
      proxyPort: 49250,
      panelPort: 6767,
      authToken: `sk_${randomBytes(16).toString("hex")}`,
    },
    providers: buildDefaultProviders(),
    routing: {
      default: { enabled: false, providerId: "", model: "" },
      opus: { enabled: false, providerId: "", model: "" },
      sonnet: { enabled: false, providerId: "", model: "" },
      haiku: { enabled: false, providerId: "", model: "" },
    },
    thinking: {
      enabled: true,
      opus: null,
      sonnet: null,
      haiku: null,
    },
    webTools: {
      enabled: true,
      allowPrivateNetworks: false,
    },
    proxy: {
      enabled: false,
      url: "",
    },
    tokenSavers: {
      rtkEnabled: false,
      cavemanEnabled: false,
      cavemanLevel: "lite",
    },
    activeProvider: "nvidia_nim",
    modelMode: "single",
    activeModelFallbackSlug: null,
    modelFallbacks: [],
    panelSettings: {
      favoriteProviders: [],
      favoritesTipDismissed: false,
    },
  };
}

export function loadConfig(): Config {
  const path = getConfigPath();
  const store = getSecretStore();

  if (!existsSync(path)) {
    const fresh = buildDefaultConfig();
    saveConfig(fresh);
    return fresh;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    const defaults = buildDefaultConfig();
    const merged = normalizeConfig(deepMerge(defaults, parsed) as Config, defaults);
    const hasStoredAuthToken = store.get(SECRET_KEYS.serverAuthToken) !== null;

    // One-shot migration: legacy JSON has secrets inline → move them into the store.
    if (parsedJsonStillHasSecrets(parsed)) {
      extractSecretsToStore(merged, store);
      writePrivateFile(path, JSON.stringify(merged, null, 2));
    }

    hydrateSecretsFromStore(merged, store);
    if (!hasStoredAuthToken) saveConfig(merged);
    return merged;
  } catch {
    return buildDefaultConfig();
  }
}

export function saveConfig(config: Config): void {
  // Splitter mutates the clone, leaving the caller's object intact with its
  // secrets still populated for in-process use.
  const onDisk = structuredClone(config);
  extractSecretsToStore(onDisk, getSecretStore());
  writePrivateFile(getConfigPath(), JSON.stringify(onDisk, null, 2));
}

export function isFirstRun(): boolean {
  return !existsSync(getConfigPath());
}

function parsedJsonStillHasSecrets(config: Partial<Config>): boolean {
  if (config.server?.authToken) return true;
  const providers = config.providers ?? {};
  for (const provider of Object.values(providers) as Partial<ProviderConfig>[]) {
    if (!provider) continue;
    if (provider.apiKey) return true;
    if (provider.oauth?.accessToken || provider.oauth?.refreshToken || provider.oauth?.copilotToken)
      return true;
  }
  return false;
}

// Simple deep merge: values from `override` win, but missing keys fall back to `base`
function deepMerge(base: unknown, override: unknown): unknown {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || typeof override !== "object") return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;

  const result = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const overrideVal = (override as Record<string, unknown>)[key];
    const baseVal = (base as Record<string, unknown>)[key];
    result[key] = deepMerge(baseVal, overrideVal);
  }
  return result;
}
