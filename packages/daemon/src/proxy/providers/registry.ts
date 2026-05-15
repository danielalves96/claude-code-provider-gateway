import type { Config, ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_IDS } from "../../config/schema.js";
import type { BaseProvider } from "./base.js";
import { CopilotProvider } from "./copilot.js";
import { DeepSeekProvider } from "./deepseek.js";
import { GoogleProvider } from "./google.js";
import { KimiProvider } from "./kimi.js";
import { LlamaCppProvider } from "./llamacpp.js";
import { LMStudioProvider } from "./lmstudio.js";
import { NvidiaNimProvider } from "./nvidia-nim.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIAccountProvider } from "./openai-account.js";
import { OpenRouterProvider } from "./openrouter.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

const PROVIDER_MAP: Record<ProviderId, ProviderConstructor> = {
  openai_account: OpenAIAccountProvider,
  copilot: CopilotProvider,
  nvidia_nim: NvidiaNimProvider,
  openrouter: OpenRouterProvider,
  deepseek: DeepSeekProvider,
  kimi: KimiProvider,
  google: GoogleProvider,
  ollama: OllamaProvider,
  lmstudio: LMStudioProvider,
  llamacpp: LlamaCppProvider,
};

export class ProviderRegistry {
  private cache = new Map<ProviderId, BaseProvider>();

  constructor(private config: Config) {}

  get(id: ProviderId): BaseProvider | null {
    const providerConfig = this.config.providers[id];
    if (!providerConfig?.enabled) return null;

    if (!this.cache.has(id)) {
      const Ctor = PROVIDER_MAP[id];
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

  all(): Array<{ id: ProviderId; provider: BaseProvider }> {
    const result: Array<{ id: ProviderId; provider: BaseProvider }> = [];
    for (const id of PROVIDER_IDS) {
      const p = this.get(id);
      if (p) result.push({ id, provider: p });
    }
    return result;
  }
}
