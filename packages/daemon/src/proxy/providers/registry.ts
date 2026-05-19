import type { BuiltInProviderId, Config, ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_IDS } from "../../config/schema.js";
import type { BaseProvider } from "./base.js";
import { ClineProvider } from "./cline.js";
import { CommandCodeProvider } from "./commandcode.js";
import { CopilotProvider } from "./copilot.js";
import { DeepSeekProvider } from "./deepseek.js";
import { GoogleProvider } from "./google.js";
import { IFlowProvider } from "./iflow.js";
import { KiloCodeProvider } from "./kilocode.js";
import { KiroProvider } from "./kiro.js";
import { OllamaProvider } from "./ollama.js";
import { OllamaCloudProvider } from "./ollama-cloud.js";
import { OpenAIAccountProvider } from "./openai-account.js";
import { createAnthropicProvider, createOpenAIProvider } from "./provider-factory.js";
import { AnthropicMessagesTransport } from "./transport-anthropic.js";
import { OpenAIChatTransport } from "./transport-openai.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

const PROVIDER_MAP: Record<BuiltInProviderId, ProviderConstructor> = {
  openai_account: OpenAIAccountProvider,
  copilot: CopilotProvider,
  nvidia_nim: createOpenAIProvider("nvidia_nim"),
  openrouter: createAnthropicProvider("openrouter", {
    extraHeaders: { "HTTP-Referer": "https://github.com/claude-code-provider-gateway" },
  }),
  deepseek: DeepSeekProvider,
  kimi: createOpenAIProvider("kimi"),
  google: GoogleProvider,
  ollama: OllamaProvider,
  lmstudio: createAnthropicProvider("lmstudio", { requiresApiKey: false }),
  llamacpp: createAnthropicProvider("llamacpp", { requiresApiKey: false }),
  groq: createOpenAIProvider("groq"),
  xai: createOpenAIProvider("xai"),
  mistral: createOpenAIProvider("mistral"),
  cerebras: createOpenAIProvider("cerebras"),
  together: createOpenAIProvider("together"),
  fireworks: createOpenAIProvider("fireworks"),
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
  kiro: KiroProvider,
  iflow: IFlowProvider,
  kilocode: KiloCodeProvider,
  cline: ClineProvider,
  ollama_cloud: OllamaCloudProvider,
  commandcode: CommandCodeProvider,
};

export class ProviderRegistry {
  private cache = new Map<string, BaseProvider>();

  constructor(private config: Config) {}

  get(id: ProviderId): BaseProvider | null {
    const providerConfig = this.config.providers[id];
    if (!providerConfig?.enabled) return null;

    if (!this.cache.has(id)) {
      const Ctor = this.constructorFor(id, providerConfig);
      if (!Ctor) return null;
      this.cache.set(id, new Ctor(providerConfig, this.config));
    }

    return this.cache.get(id)!;
  }

  getActive(): BaseProvider | null {
    return this.get(this.config.activeProvider);
  }

  updateConfig(config: Config): void {
    this.config = config;
    this.cache.clear();
  }

  all(): Array<{ id: string; provider: BaseProvider }> {
    const result: Array<{ id: string; provider: BaseProvider }> = [];
    for (const id of Object.keys(this.config.providers)) {
      const p = this.get(id);
      if (p) result.push({ id, provider: p });
    }
    return result;
  }

  private constructorFor(id: string, providerConfig: ProviderConfig): ProviderConstructor | null {
    if (providerConfig.custom) {
      if ((PROVIDER_IDS as readonly string[]).includes(id)) return null;
      if (providerConfig.custom.compatibility === "openai") return createCustomOpenAIProvider(id);
      if (providerConfig.custom.compatibility === "anthropic") {
        return createCustomAnthropicProvider(id);
      }
      return null;
    }
    if ((PROVIDER_IDS as readonly string[]).includes(id)) {
      return PROVIDER_MAP[id as BuiltInProviderId];
    }
    return null;
  }
}

function createCustomOpenAIProvider(id: string): ProviderConstructor {
  return class CustomOpenAIProvider extends OpenAIChatTransport {
    get id() {
      return id;
    }

    get label() {
      return this.config.custom?.label ?? id;
    }
  };
}

function createCustomAnthropicProvider(id: string): ProviderConstructor {
  return class CustomAnthropicProvider extends AnthropicMessagesTransport {
    get id() {
      return id;
    }

    get label() {
      return this.config.custom?.label ?? id;
    }
  };
}
