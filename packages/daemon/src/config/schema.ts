export const PROVIDER_IDS = [
  'openai_account',
  'copilot',
  'nvidia_nim',
  'openrouter',
  'deepseek',
  'kimi',
  'google',
  'ollama',
  'lmstudio',
  'llamacpp',
] as const

export type ProviderId = typeof PROVIDER_IDS[number]

export interface ProviderOAuthConfig {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  accountId?: string
  planType?: string
  // Copilot-specific: short-lived token derived from accessToken (the GH OAuth token)
  copilotToken?: string
  copilotExpiresAt?: number
  copilotEndpoint?: string
}

export interface ProviderConfig {
  enabled: boolean
  apiKey?: string
  authType?: 'api_key' | 'oauth'
  oauth?: ProviderOAuthConfig
  models?: string[]
  disabledModels?: string[]
  baseUrl?: string
  rateLimit: number
  rateWindow: number
  maxConcurrency: number
  requestTimeoutMs?: number
}

export type ModelMode = 'single' | 'all'

export interface RoutingRule {
  enabled: boolean
  providerId: ProviderId | ''
  model: string
}

export type RoutingTier = 'default' | 'opus' | 'sonnet' | 'haiku'

export interface Config {
  server: {
    proxyPort: number
    panelPort: number
    authToken: string
  }
  providers: Record<ProviderId, ProviderConfig>
  routing: Record<RoutingTier, RoutingRule>
  thinking: {
    enabled: boolean
    opus: boolean | null
    sonnet: boolean | null
    haiku: boolean | null
  }
  webTools: {
    enabled: boolean
    allowPrivateNetworks: boolean
  }
  proxy: {
    enabled: boolean
    url: string
  }
  activeProvider: ProviderId
  modelMode: ModelMode
}

export const PROVIDER_DEFAULTS: Record<ProviderId, Partial<ProviderConfig> & { baseUrl?: string }> = {
  openai_account: { baseUrl: 'https://chatgpt.com/backend-api', models: [] },
  copilot: { baseUrl: 'https://api.individual.githubcopilot.com', models: [] },
  nvidia_nim: { baseUrl: 'https://integrate.api.nvidia.com/v1' },
  openrouter:  { baseUrl: 'https://openrouter.ai/api/v1' },
  deepseek:    { baseUrl: 'https://api.deepseek.com/anthropic' },
  kimi:        { baseUrl: 'https://api.moonshot.ai/v1' },
  google:      { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  ollama:      { baseUrl: 'http://localhost:11434' },
  lmstudio:    { baseUrl: 'http://localhost:1234/v1' },
  llamacpp:    { baseUrl: 'http://localhost:8080/v1' },
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai_account: 'OpenAI Account',
  copilot: 'GitHub Copilot',
  nvidia_nim: 'NVIDIA NIM',
  openrouter:  'OpenRouter',
  deepseek:    'DeepSeek',
  kimi:        'Kimi (Moonshot)',
  google:      'Google AI',
  ollama:      'Ollama',
  lmstudio:    'LM Studio',
  llamacpp:    'llama.cpp',
}

export const CLI_FLAGS: Record<string, ProviderId> = {
  '--OpenAIAccount': 'openai_account',
  '--Copilot':    'copilot',
  '--GitHubCopilot': 'copilot',
  '--NvidiaNim':  'nvidia_nim',
  '--OpenRouter': 'openrouter',
  '--DeepSeek':   'deepseek',
  '--Kimi':       'kimi',
  '--Google':     'google',
  '--GoogleAI':   'google',
  '--Ollama':     'ollama',
  '--LMStudio':   'lmstudio',
  '--LlamaCpp':   'llamacpp',
}
