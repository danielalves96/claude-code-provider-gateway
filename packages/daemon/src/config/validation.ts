import type { CavemanLevel, Config, ModelMode, ProviderConfig, ProviderId, RoutingRule } from './schema.js'
import { PROVIDER_IDS } from './schema.js'

const PROVIDER_ID_SET = new Set<string>(PROVIDER_IDS)
const MODEL_MODES = new Set<ModelMode>(['single', 'all'])
const CAVEMAN_LEVELS = new Set<CavemanLevel>(['lite', 'full', 'ultra'])

export function normalizeConfig(config: Config, defaults: Config): Config {
  return {
    server: {
      proxyPort: numberOrDefault(config.server.proxyPort, defaults.server.proxyPort),
      panelPort: numberOrDefault(config.server.panelPort, defaults.server.panelPort),
      authToken: stringOrDefault(config.server.authToken, defaults.server.authToken),
    },
    providers: normalizeProviders(config.providers, defaults.providers),
    routing: {
      default: normalizeRoutingRule(config.routing?.default, defaults.routing.default),
      opus: normalizeRoutingRule(config.routing?.opus, defaults.routing.opus),
      sonnet: normalizeRoutingRule(config.routing?.sonnet, defaults.routing.sonnet),
      haiku: normalizeRoutingRule(config.routing?.haiku, defaults.routing.haiku),
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
      url: stringOrDefault(config.proxy?.url, defaults.proxy.url) || '',
    },
    tokenSavers: {
      rtkEnabled: booleanOrDefault(config.tokenSavers?.rtkEnabled, defaults.tokenSavers.rtkEnabled),
      cavemanEnabled: booleanOrDefault(config.tokenSavers?.cavemanEnabled, defaults.tokenSavers.cavemanEnabled),
      cavemanLevel: cavemanLevelOrDefault(config.tokenSavers?.cavemanLevel, defaults.tokenSavers.cavemanLevel),
    },
    activeProvider: providerIdOrDefault(config.activeProvider, defaults.activeProvider),
    modelMode: modelModeOrDefault(config.modelMode, defaults.modelMode),
  }
}

function normalizeProviders(
  providers: Record<ProviderId, ProviderConfig>,
  defaults: Record<ProviderId, ProviderConfig>,
): Record<ProviderId, ProviderConfig> {
  return PROVIDER_IDS.reduce((out, id) => {
    const provider = providers[id]
    const fallback = defaults[id]
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
    }
    return out
  }, {} as Record<ProviderId, ProviderConfig>)
}

function normalizeOAuth(
  value: ProviderConfig['oauth'],
  fallback: ProviderConfig['oauth'],
): ProviderConfig['oauth'] {
  if (!value || typeof value !== 'object') return fallback
  return {
    accessToken: optionalString(value.accessToken),
    refreshToken: optionalString(value.refreshToken),
    expiresAt: optionalPositiveNumber(value.expiresAt),
    accountId: optionalString(value.accountId),
    planType: optionalString(value.planType),
  }
}

function normalizeRoutingRule(value: unknown, fallback: RoutingRule): RoutingRule {
  // Legacy migration: string "provider_id/model-name"
  if (typeof value === 'string') {
    const slash = value.indexOf('/')
    if (slash > 0) {
      const pid = value.slice(0, slash)
      const model = value.slice(slash + 1)
      if (PROVIDER_ID_SET.has(pid) && model) {
        return { enabled: true, providerId: pid as ProviderId, model }
      }
    }
    return { enabled: false, providerId: '', model: '' }
  }
  if (!value || typeof value !== 'object') return fallback
  const v = value as Partial<RoutingRule>
  const providerId =
    typeof v.providerId === 'string' && (v.providerId === '' || PROVIDER_ID_SET.has(v.providerId))
      ? (v.providerId as ProviderId | '')
      : ''
  const model = typeof v.model === 'string' ? v.model : ''
  const enabledRaw = typeof v.enabled === 'boolean' ? v.enabled : false
  // A rule can only be considered enabled if it has both a provider and a model
  const enabled = enabledRaw && !!providerId && !!model
  return { enabled, providerId, model }
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeStringList(value: unknown, fallback: string[] | undefined): string[] | undefined {
  if (!Array.isArray(value)) return fallback
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const model = item.trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    out.push(model)
  }
  return out
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optionalPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function nullableBooleanOrDefault(value: unknown, fallback: boolean | null): boolean | null {
  return value === null || typeof value === 'boolean' ? value : fallback
}

function authTypeOrDefault(value: unknown, fallback: ProviderConfig['authType']): ProviderConfig['authType'] {
  return value === 'oauth' || value === 'api_key' ? value : fallback
}

function providerIdOrDefault(value: unknown, fallback: ProviderId): ProviderId {
  return typeof value === 'string' && PROVIDER_ID_SET.has(value) ? value as ProviderId : fallback
}

function modelModeOrDefault(value: unknown, fallback: ModelMode): ModelMode {
  return typeof value === 'string' && MODEL_MODES.has(value as ModelMode) ? value as ModelMode : fallback
}

function cavemanLevelOrDefault(value: unknown, fallback: CavemanLevel): CavemanLevel {
  return typeof value === 'string' && CAVEMAN_LEVELS.has(value as CavemanLevel)
    ? value as CavemanLevel
    : fallback
}
