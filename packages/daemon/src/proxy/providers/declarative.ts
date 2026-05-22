import type { BuiltInProviderId, Config, ProviderConfig } from "../../config/schema.js";
import {
  createAnthropicProvider,
  createOAuthStubProvider,
  createOpenAIProvider,
} from "./provider-factory.js";
import type { BaseProvider } from "./shared/index.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

export const DECLARATIVE_PROVIDER_MAP = {
  nvidia_nim: createOpenAIProvider("nvidia_nim"),
  openrouter: createAnthropicProvider("openrouter", {
    extraHeaders: { "HTTP-Referer": "https://github.com/claude-code-provider-gateway" },
  }),
  deepseek: createAnthropicProvider("deepseek", {
    listModelsBaseUrl: (baseUrl) => baseUrl.replace(/\/anthropic\/?$/, ""),
  }),
  kimi: createOpenAIProvider("kimi"),
  google: createOpenAIProvider("google"),
  ollama: createOpenAIProvider("ollama", {
    normalizeBaseUrl: ensureOpenAIBaseUrl,
    requiresApiKey: false,
  }),
  lmstudio: createAnthropicProvider("lmstudio", { requiresApiKey: false }),
  llamacpp: createAnthropicProvider("llamacpp", { requiresApiKey: false }),
  groq: createOpenAIProvider("groq"),
  xai: createOpenAIProvider("xai"),
  mistral: createOpenAIProvider("mistral"),
  cerebras: createOpenAIProvider("cerebras"),
  together: createOpenAIProvider("together"),
  fireworks: createOpenAIProvider("fireworks"),
  tuning_engines: createOpenAIProvider("tuning_engines"),
  glm: createAnthropicProvider("glm", { authHeaderStyle: "x-api-key" }),
  siliconflow: createOpenAIProvider("siliconflow"),
  hyperbolic: createOpenAIProvider("hyperbolic"),
  chutes: createOpenAIProvider("chutes"),
  perplexity: createOpenAIProvider("perplexity"),
  nebius: createOpenAIProvider("nebius"),
  glm_cn: createOpenAIProvider("glm_cn"),
  volcengine_ark: createOpenAIProvider("volcengine_ark"),
  byteplus: createOpenAIProvider("byteplus"),
  alicode: createOpenAIProvider("alicode"),
  alicode_intl: createOpenAIProvider("alicode_intl"),
  minimax: createAnthropicProvider("minimax", { authHeaderStyle: "x-api-key" }),
  minimax_cn: createAnthropicProvider("minimax_cn", { authHeaderStyle: "x-api-key" }),
  opencode_go: createOpenAIProvider("opencode_go"),
  xiaomi_mimo: createOpenAIProvider("xiaomi_mimo"),
  xiaomi_tokenplan: createOpenAIProvider("xiaomi_tokenplan"),
  cohere: createOpenAIProvider("cohere"),
  blackbox: createOpenAIProvider("blackbox"),
  huggingface: createOpenAIProvider("huggingface"),
  kiro: createOAuthStubProvider("kiro"),
  iflow: createOAuthStubProvider("iflow"),
  ollama_cloud: createOpenAIProvider("ollama_cloud", {
    normalizeBaseUrl: ensureOpenAIBaseUrl,
  }),
} satisfies Partial<Record<BuiltInProviderId, ProviderConstructor>>;

function ensureOpenAIBaseUrl(baseUrl: string): string {
  const url = baseUrl.replace(/\/$/, "");
  return url.endsWith("/v1") ? url : `${url}/v1`;
}
