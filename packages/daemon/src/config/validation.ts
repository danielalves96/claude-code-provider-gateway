import type {
  CavemanLevel,
  Config,
  ModelFallbackConfig,
  ModelFallbackEntry,
  ModelMode,
  ProviderConfig,
  ProviderId,
  RoutingRule,
} from "./schema.js";
import { PROVIDER_IDS } from "./schema.js";

const PROVIDER_ID_SET = new Set<string>(PROVIDER_IDS);
const MODEL_MODES = new Set<ModelMode>(["single", "all", "chains"]);
const CAVEMAN_LEVELS = new Set<CavemanLevel>(["lite", "full", "ultra"]);

export function normalizeConfig(config: Config, defaults: Config): Config {
  const providers = normalizeProviders(config.providers, defaults.providers);
  const knownProviderIds = new Set([
    ...(PROVIDER_IDS as readonly string[]),
    ...Object.keys(providers),
  ]);
  const modelFallbacks = normalizeModelFallbacks(
    config.modelFallbacks,
    defaults.modelFallbacks,
    knownProviderIds,
  );

  return {
    server: {
      proxyPort: numberOrDefault(config.server.proxyPort, defaults.server.proxyPort),
      panelPort: numberOrDefault(config.server.panelPort, defaults.server.panelPort),
      authToken: stringOrDefault(config.server.authToken, defaults.server.authToken),
    },
    providers,
    routing: {
      default: normalizeRoutingRule(
        config.routing?.default,
        defaults.routing.default,
        knownProviderIds,
      ),
      opus: normalizeRoutingRule(config.routing?.opus, defaults.routing.opus, knownProviderIds),
      sonnet: normalizeRoutingRule(
        config.routing?.sonnet,
        defaults.routing.sonnet,
        knownProviderIds,
      ),
      haiku: normalizeRoutingRule(config.routing?.haiku, defaults.routing.haiku, knownProviderIds),
    },
    thinking: {
      enabled: booleanOrDefault(config.thinking.enabled, defaults.thinking.enabled),
      opus: nullableBooleanOrDefault(config.thinking.opus, defaults.thinking.opus),
      sonnet: nullableBooleanOrDefault(config.thinking.sonnet, defaults.thinking.sonnet),
      haiku: nullableBooleanOrDefault(config.thinking.haiku, defaults.thinking.haiku),
    },
    webTools: {
      enabled: booleanOrDefault(config.webTools.enabled, defaults.webTools.enabled),
      allowPrivateNetworks: booleanOrDefault(
        config.webTools.allowPrivateNetworks,
        defaults.webTools.allowPrivateNetworks,
      ),
    },
    proxy: {
      enabled: booleanOrDefault(config.proxy?.enabled, defaults.proxy.enabled),
      url: stringOrDefault(config.proxy?.url, defaults.proxy.url) || "",
    },
    tokenSavers: {
      rtkEnabled: booleanOrDefault(config.tokenSavers?.rtkEnabled, defaults.tokenSavers.rtkEnabled),
      cavemanEnabled: booleanOrDefault(
        config.tokenSavers?.cavemanEnabled,
        defaults.tokenSavers.cavemanEnabled,
      ),
      cavemanLevel: cavemanLevelOrDefault(
        config.tokenSavers?.cavemanLevel,
        defaults.tokenSavers.cavemanLevel,
      ),
    },
    activeProvider: activeProviderOrDefault(
      config.activeProvider,
      defaults.activeProvider,
      providers,
    ),
    modelMode: modelModeOrDefault(config.modelMode, defaults.modelMode),
    activeModelFallbackSlug: normalizeActiveModelFallbackSlug(
      config.activeModelFallbackSlug,
      defaults.activeModelFallbackSlug,
      modelFallbacks,
    ),
    modelFallbacks,
    panelSettings: {
      favoriteProviders: normalizeProviderIdList(
        config.panelSettings?.favoriteProviders,
        defaults.panelSettings.favoriteProviders,
        knownProviderIds,
      ),
      favoritesTipDismissed: booleanOrDefault(
        config.panelSettings?.favoritesTipDismissed,
        defaults.panelSettings.favoritesTipDismissed,
      ),
    },
  };
}

function normalizeModelFallbacks(
  value: unknown,
  fallback: ModelFallbackConfig[],
  knownProviderIds: Set<string>,
): ModelFallbackConfig[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const out: ModelFallbackConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Partial<ModelFallbackConfig>;
    const slug = normalizeSlug(raw.slug);
    if (!slug || seen.has(slug)) continue;
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : slug;
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `chain_${slug.replaceAll("-", "_")}`;
    const models = normalizeModelFallbackEntries(raw.models, knownProviderIds);
    seen.add(slug);
    out.push({ id, name, slug, models, enabled: raw.enabled !== false && models.length > 0 });
  }
  return out;
}

function normalizeModelFallbackEntries(
  value: unknown,
  knownProviderIds: Set<string>,
): ModelFallbackEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ModelFallbackEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Partial<ModelFallbackEntry>;
    const providerId =
      typeof raw.providerId === "string" && isKnownProviderId(raw.providerId, knownProviderIds)
        ? raw.providerId
        : null;
    const model = typeof raw.model === "string" ? raw.model.trim() : "";
    const key = providerId && model ? `${providerId}/${model}` : "";
    if (!providerId || !model || seen.has(key)) continue;
    seen.add(key);
    out.push({ providerId, model });
  }
  return out;
}

function normalizeActiveModelFallbackSlug(
  value: unknown,
  fallback: string | null,
  modelFallbacks: ModelFallbackConfig[],
): string | null {
  const normalized = nullableSlugOrDefault(value, fallback);
  if (normalized && hasEnabledFallbackSlug(modelFallbacks, normalized)) return normalized;
  if (fallback && fallback !== normalized && hasEnabledFallbackSlug(modelFallbacks, fallback)) {
    return fallback;
  }
  return null;
}

function hasEnabledFallbackSlug(modelFallbacks: ModelFallbackConfig[], slug: string): boolean {
  return modelFallbacks.some(
    (fallback) => fallback.enabled && fallback.slug === slug && fallback.models.length > 0,
  );
}

function normalizeProviders(
  providers: Record<string, ProviderConfig>,
  defaults: Record<string, ProviderConfig>,
): Record<string, ProviderConfig> {
  return mergeProviderIds(providers, defaults).reduce(
    (out, id) => {
      const provider = providers[id];
      const fallback = defaults[id] ?? defaultCustomProviderConfig(provider, id);
      out[id] = {
        enabled: booleanOrDefault(provider.enabled, fallback.enabled),
        apiKey: optionalString(provider.apiKey),
        authType: authTypeOrDefault(provider.authType, fallback.authType),
        oauth: normalizeOAuth(provider.oauth, fallback.oauth),
        models: normalizeStringList(provider.models, fallback.models),
        disabledModels: normalizeStringList(provider.disabledModels, fallback.disabledModels),
        baseUrl: optionalString(provider.baseUrl) ?? fallback.baseUrl,
        rateLimit: numberOrDefault(provider.rateLimit, fallback.rateLimit),
        rateWindow: numberOrDefault(provider.rateWindow, fallback.rateWindow),
        maxConcurrency: numberOrDefault(provider.maxConcurrency, fallback.maxConcurrency),
        requestTimeoutMs: optionalPositiveNumber(provider.requestTimeoutMs),
        custom: normalizeCustomProvider(provider.custom, fallback.custom, id),
      };
      return out;
    },
    {} as Record<string, ProviderConfig>,
  );
}

function mergeProviderIds(
  providers: Record<string, ProviderConfig> | undefined,
  defaults: Record<string, ProviderConfig>,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [...PROVIDER_IDS, ...Object.keys(providers ?? {}), ...Object.keys(defaults)]) {
    if (seen.has(id)) continue;
    if (!PROVIDER_ID_SET.has(id) && !isCustomProviderId(id, providers?.[id])) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isCustomProviderId(id: string, provider: ProviderConfig | undefined): boolean {
  return !!provider?.custom && normalizeSlug(id) === id;
}

function defaultCustomProviderConfig(
  provider: ProviderConfig | undefined,
  id: string,
): ProviderConfig {
  return {
    enabled: false,
    apiKey: "",
    authType: "api_key",
    models: [],
    disabledModels: [],
    baseUrl: "",
    rateLimit: 40,
    rateWindow: 60,
    maxConcurrency: 5,
    custom: {
      label: provider?.custom?.label || id,
      slug: id,
      logoFile: provider?.custom?.logoFile,
      compatibility: provider?.custom?.compatibility === "anthropic" ? "anthropic" : "openai",
    },
  };
}

function normalizeCustomProvider(
  value: ProviderConfig["custom"],
  fallback: ProviderConfig["custom"],
  id: string,
): ProviderConfig["custom"] {
  const source = value ?? fallback;
  if (!source || typeof source !== "object") return undefined;
  const label = typeof source.label === "string" && source.label.trim() ? source.label.trim() : id;
  const slug = normalizeSlug(source.slug) ?? id;
  const logoFile =
    typeof source.logoFile === "string" && /^[a-zA-Z0-9_-]+\.(png|webp)$/.test(source.logoFile)
      ? source.logoFile
      : undefined;
  const compatibility = source.compatibility === "anthropic" ? "anthropic" : "openai";
  return { label, slug, logoFile, compatibility };
}

function normalizeOAuth(
  value: ProviderConfig["oauth"],
  fallback: ProviderConfig["oauth"],
): ProviderConfig["oauth"] {
  if (!value || typeof value !== "object") return fallback;
  return {
    accessToken: optionalString(value.accessToken),
    refreshToken: optionalString(value.refreshToken),
    expiresAt: optionalPositiveNumber(value.expiresAt),
    accountId: optionalString(value.accountId),
    planType: optionalString(value.planType),
    copilotToken: optionalString(value.copilotToken),
    copilotExpiresAt: optionalPositiveNumber(value.copilotExpiresAt),
    copilotEndpoint: optionalString(value.copilotEndpoint),
    orgId: optionalString(value.orgId),
  };
}

function normalizeRoutingRule(
  value: unknown,
  fallback: RoutingRule,
  knownProviderIds: Set<string>,
): RoutingRule {
  // Legacy migration: string "provider_id/model-name"
  if (typeof value === "string") {
    const slash = value.indexOf("/");
    if (slash > 0) {
      const pid = value.slice(0, slash);
      const model = value.slice(slash + 1);
      if (isKnownProviderId(pid, knownProviderIds) && model) {
        return { enabled: true, providerId: pid, model };
      }
    }
    return { enabled: false, providerId: "", model: "" };
  }
  if (!value || typeof value !== "object") return fallback;
  const v = value as Partial<RoutingRule>;
  const providerId =
    typeof v.providerId === "string" &&
    (v.providerId === "" || isKnownProviderId(v.providerId, knownProviderIds))
      ? (v.providerId as ProviderId | "")
      : "";
  const model = typeof v.model === "string" ? v.model : "";
  const enabledRaw = typeof v.enabled === "boolean" ? v.enabled : false;
  // A rule can only be considered enabled if it has both a provider and a model
  const enabled = enabledRaw && !!providerId && !!model;
  return { enabled, providerId, model };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableSlugOrDefault(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  return normalizeSlug(value) ?? fallback;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().replace(/^--/, "");
  return /^[a-zA-Z][a-zA-Z0-9_-]{1,62}$/.test(slug) ? slug : null;
}

function normalizeStringList(value: unknown, fallback: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const model = item.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function nullableBooleanOrDefault(value: unknown, fallback: boolean | null): boolean | null {
  return value === null || typeof value === "boolean" ? value : fallback;
}

function authTypeOrDefault(
  value: unknown,
  fallback: ProviderConfig["authType"],
): ProviderConfig["authType"] {
  return value === "oauth" || value === "api_key" ? value : fallback;
}

function activeProviderOrDefault(
  value: unknown,
  fallback: ProviderId,
  providers: Record<string, ProviderConfig>,
): ProviderId {
  return typeof value === "string" && providers[value] ? value : fallback;
}

function modelModeOrDefault(value: unknown, fallback: ModelMode): ModelMode {
  return typeof value === "string" && MODEL_MODES.has(value as ModelMode)
    ? (value as ModelMode)
    : fallback;
}

function cavemanLevelOrDefault(value: unknown, fallback: CavemanLevel): CavemanLevel {
  return typeof value === "string" && CAVEMAN_LEVELS.has(value as CavemanLevel)
    ? (value as CavemanLevel)
    : fallback;
}

function normalizeProviderIdList(
  value: unknown,
  fallback: ProviderId[],
  knownProviderIds: Set<string>,
): ProviderId[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<ProviderId>();
  const out: ProviderId[] = [];
  for (const item of value) {
    if (typeof item === "string" && isKnownProviderId(item, knownProviderIds)) {
      if (!seen.has(item as ProviderId)) {
        seen.add(item as ProviderId);
        out.push(item as ProviderId);
      }
    }
  }
  return out;
}

function isKnownProviderId(id: string, knownProviderIds: Set<string>): boolean {
  return knownProviderIds.has(id);
}
