import type { BuiltInProviderId, Config, ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_IDS } from "../../config/schema.js";
import { ClineProvider } from "./cline/index.js";
import { CommandCodeProvider } from "./commandcode/index.js";
import { CopilotProvider } from "./copilot/index.js";
import { DECLARATIVE_PROVIDER_MAP } from "./declarative.js";
import { KiloCodeProvider } from "./kilocode/index.js";
import { OpenAIAccountProvider } from "./openai-account/index.js";
import type { BaseProvider } from "./shared/index.js";
import { AnthropicMessagesTransport, OpenAIChatTransport } from "./transports/index.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

const PROVIDER_MAP: Record<BuiltInProviderId, ProviderConstructor> = {
  ...DECLARATIVE_PROVIDER_MAP,
  openai_account: OpenAIAccountProvider,
  copilot: CopilotProvider,
  kilocode: KiloCodeProvider,
  cline: ClineProvider,
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
