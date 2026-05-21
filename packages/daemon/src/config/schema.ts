export const PROVIDER_IDS = [
  "openai_account",
  "copilot",
  "nvidia_nim",
  "openrouter",
  "deepseek",
  "kimi",
  "google",
  "ollama",
  "lmstudio",
  "llamacpp",
  "groq",
  "xai",
  "mistral",
  "cerebras",
  "together",
  "fireworks",
  "glm",
  "siliconflow",
  "hyperbolic",
  "chutes",
  "perplexity",
  "nebius",
  "glm_cn",
  "volcengine_ark",
  "byteplus",
  "alicode",
  "alicode_intl",
  "minimax",
  "minimax_cn",
  "opencode_go",
  "xiaomi_mimo",
  "xiaomi_tokenplan",
  "cohere",
  "blackbox",
  "huggingface",
  "kiro",
  "iflow",
  "kilocode",
  "cline",
  "ollama_cloud",
  "commandcode",
] as const;

export const OAUTH_PROVIDER_IDS = new Set<ProviderId>([
  "openai_account",
  "copilot",
  "kiro",
  "iflow",
  "kilocode",
  "cline",
]);

export type BuiltInProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderId = BuiltInProviderId | string;

export interface ProviderOAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  planType?: string;
  // Copilot-specific: short-lived token derived from accessToken (the GH OAuth token)
  copilotToken?: string;
  copilotExpiresAt?: number;
  copilotEndpoint?: string;
  // KiloCode-specific: tenant/org id sent as X-Kilocode-OrganizationID
  orgId?: string;
}

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  authType?: "api_key" | "oauth";
  oauth?: ProviderOAuthConfig;
  models?: string[];
  disabledModels?: string[];
  baseUrl?: string;
  rateLimit: number;
  rateWindow: number;
  maxConcurrency: number;
  requestTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
  custom?: {
    label: string;
    slug: string;
    logoFile?: string;
    compatibility: "openai" | "anthropic";
  };
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 30_000;
export const DEFAULT_STREAM_TOTAL_TIMEOUT_MS = 60_000;
export const LOCAL_PROVIDER_IDS = new Set<string>(["ollama", "lmstudio", "llamacpp"]);

export function defaultRequestTimeoutMs(_providerId: string): number {
  return DEFAULT_REQUEST_TIMEOUT_MS;
}

export function defaultStreamIdleTimeoutMs(_providerId: string): number {
  return DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

export function defaultStreamTotalTimeoutMs(_providerId: string): number {
  return DEFAULT_STREAM_TOTAL_TIMEOUT_MS;
}

export type ModelMode = "single" | "all" | "chains";
export type CavemanLevel = "lite" | "full" | "ultra";

export interface RoutingRule {
  enabled: boolean;
  providerId: ProviderId | "";
  model: string;
}

export type RoutingTier = "default" | "opus" | "sonnet" | "haiku";

export interface ModelFallbackEntry {
  providerId: ProviderId;
  model: string;
}

export type ChainRoutingStrategy = "waterfall" | "round_robin";

export interface ModelFallbackConfig {
  id: string;
  name: string;
  slug: string;
  models: ModelFallbackEntry[];
  enabled: boolean;
  routingStrategy?: ChainRoutingStrategy;
  primaryAttempts?: number;
  requestTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
}

export interface Config {
  server: {
    proxyPort: number;
    panelPort: number;
    authToken: string;
  };
  providers: Record<ProviderId, ProviderConfig>;
  routing: Record<RoutingTier, RoutingRule>;
  thinking: {
    enabled: boolean;
    opus: boolean | null;
    sonnet: boolean | null;
    haiku: boolean | null;
  };
  webTools: {
    enabled: boolean;
    allowPrivateNetworks: boolean;
  };
  proxy: {
    enabled: boolean;
    url: string;
  };
  tokenSavers: {
    rtkEnabled: boolean;
    cavemanEnabled: boolean;
    cavemanLevel: CavemanLevel;
  };
  activeProvider: ProviderId;
  modelMode: ModelMode;
  activeModelFallbackSlug: string | null;
  modelFallbacks: ModelFallbackConfig[];
  panelSettings: {
    favoriteProviders: ProviderId[];
    favoritesTipDismissed: boolean;
  };
}

export const PROVIDER_DEFAULTS: Record<
  BuiltInProviderId,
  Partial<ProviderConfig> & { baseUrl?: string }
> = {
  openai_account: { baseUrl: "https://chatgpt.com/backend-api", models: [] },
  copilot: { baseUrl: "https://api.individual.githubcopilot.com", models: [] },
  nvidia_nim: { baseUrl: "https://integrate.api.nvidia.com/v1" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  deepseek: { baseUrl: "https://api.deepseek.com/anthropic" },
  kimi: { baseUrl: "https://api.moonshot.ai/v1" },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  ollama: { baseUrl: "http://localhost:11434" },
  lmstudio: { baseUrl: "http://localhost:1234/v1" },
  llamacpp: { baseUrl: "http://localhost:8080/v1" },
  groq: { baseUrl: "https://api.groq.com/openai/v1" },
  xai: { baseUrl: "https://api.x.ai/v1" },
  mistral: { baseUrl: "https://api.mistral.ai/v1" },
  cerebras: { baseUrl: "https://api.cerebras.ai/v1" },
  together: { baseUrl: "https://api.together.xyz/v1" },
  fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1" },
  glm: { baseUrl: "https://api.z.ai/api/anthropic/v1" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1" },
  hyperbolic: { baseUrl: "https://api.hyperbolic.xyz/v1" },
  chutes: { baseUrl: "https://llm.chutes.ai/v1" },
  perplexity: { baseUrl: "https://api.perplexity.ai" },
  nebius: { baseUrl: "https://api.studio.nebius.com/v1" },
  glm_cn: { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4" },
  volcengine_ark: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  byteplus: { baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3" },
  alicode: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  alicode_intl: {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  minimax: { baseUrl: "https://api.minimax.io/anthropic/v1" },
  minimax_cn: { baseUrl: "https://api.minimaxi.com/anthropic/v1" },
  opencode_go: { baseUrl: "https://opencode.ai/zen/go/v1" },
  xiaomi_mimo: { baseUrl: "https://api.xiaomimimo.com/v1" },
  xiaomi_tokenplan: { baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1" },
  cohere: { baseUrl: "https://api.cohere.ai/compatibility/v1" },
  blackbox: { baseUrl: "https://api.blackbox.ai" },
  huggingface: { baseUrl: "https://router.huggingface.co/v1" },
  kiro: { baseUrl: "" },
  iflow: { baseUrl: "https://apis.iflow.cn/v1" },
  kilocode: { baseUrl: "https://api.kilo.ai/api/openrouter" },
  cline: { baseUrl: "https://api.cline.bot/api/v1" },
  ollama_cloud: { baseUrl: "https://ollama.com" },
  commandcode: { baseUrl: "https://api.commandcode.ai/alpha/generate", models: [] },
};

export const PROVIDER_LABELS: Record<BuiltInProviderId, string> = {
  openai_account: "OpenAI Account",
  copilot: "GitHub Copilot",
  nvidia_nim: "NVIDIA NIM",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  kimi: "Kimi (Moonshot)",
  google: "Google AI (Gemini)",
  ollama: "Ollama Local",
  lmstudio: "LM Studio",
  llamacpp: "llama.cpp",
  groq: "Groq",
  xai: "xAI (Grok)",
  mistral: "Mistral",
  cerebras: "Cerebras",
  together: "Together AI",
  fireworks: "Fireworks AI",
  glm: "GLM (Z.AI)",
  siliconflow: "SiliconFlow",
  hyperbolic: "Hyperbolic",
  chutes: "Chutes AI",
  perplexity: "Perplexity",
  nebius: "Nebius AI",
  glm_cn: "GLM (China)",
  volcengine_ark: "Volcengine Ark",
  byteplus: "BytePlus ModelArk",
  alicode: "Alibaba Bailian",
  alicode_intl: "Alibaba Bailian (Intl)",
  minimax: "Minimax",
  minimax_cn: "Minimax (China)",
  opencode_go: "OpenCode Go",
  xiaomi_mimo: "Xiaomi MiMo",
  xiaomi_tokenplan: "Xiaomi MiMo (Token Plan)",
  cohere: "Cohere",
  blackbox: "Blackbox AI",
  huggingface: "HuggingFace",
  kiro: "Kiro AI",
  iflow: "iFlow AI",
  kilocode: "Kilo Code",
  cline: "Cline",
  ollama_cloud: "Ollama Cloud",
  commandcode: "Command Code",
};

export const CLI_FLAGS: Record<string, BuiltInProviderId> = {
  "--OpenAIAccount": "openai_account",
  "--Copilot": "copilot",
  "--GitHubCopilot": "copilot",
  "--NvidiaNim": "nvidia_nim",
  "--OpenRouter": "openrouter",
  "--DeepSeek": "deepseek",
  "--Kimi": "kimi",
  "--Google": "google",
  "--GoogleAI": "google",
  "--Ollama": "ollama",
  "--OllamaLocal": "ollama",
  "--OllamaCloud": "ollama_cloud",
  "--LMStudio": "lmstudio",
  "--LlamaCpp": "llamacpp",
  "--Groq": "groq",
  "--XAI": "xai",
  "--Grok": "xai",
  "--Mistral": "mistral",
  "--Cerebras": "cerebras",
  "--Together": "together",
  "--Fireworks": "fireworks",
  "--GLM": "glm",
  "--ZAI": "glm",
  "--SiliconFlow": "siliconflow",
  "--Hyperbolic": "hyperbolic",
  "--Chutes": "chutes",
  "--Perplexity": "perplexity",
  "--Nebius": "nebius",
  "--GLMCN": "glm_cn",
  "--VolcengineArk": "volcengine_ark",
  "--Ark": "volcengine_ark",
  "--BytePlus": "byteplus",
  "--Alicode": "alicode",
  "--Bailian": "alicode",
  "--AlicodeIntl": "alicode_intl",
  "--Minimax": "minimax",
  "--MinimaxCN": "minimax_cn",
  "--OpenCodeGo": "opencode_go",
  "--XiaomiMimo": "xiaomi_mimo",
  "--MiMo": "xiaomi_mimo",
  "--XiaomiTokenPlan": "xiaomi_tokenplan",
  "--Cohere": "cohere",
  "--Blackbox": "blackbox",
  "--HuggingFace": "huggingface",
  "--HF": "huggingface",
  "--Kiro": "kiro",
  "--IFlow": "iflow",
  "--KiloCode": "kilocode",
  "--Cline": "cline",
  "--CommandCode": "commandcode",
};
