import type { Config, ProviderConfig, ProviderId } from "../../config/schema.js";
import { PROVIDER_LABELS } from "../../config/schema.js";
import type { BaseProvider } from "./base.js";
import { AnthropicMessagesTransport } from "./transport-anthropic.js";
import { OpenAIChatTransport } from "./transport-openai.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

interface ProviderFactoryOptions {
  authHeaderStyle?: "bearer" | "x-api-key";
  extraHeaders?: Record<string, string>;
  requiresApiKey?: boolean;
}

export function createOpenAIProvider(
  id: ProviderId,
  options: ProviderFactoryOptions = {},
): ProviderConstructor {
  return class ConfiguredOpenAIProvider extends OpenAIChatTransport {
    get id() {
      return id;
    }

    get label() {
      return PROVIDER_LABELS[id];
    }

    protected override extraHeaders(): Record<string, string> {
      return options.extraHeaders ?? {};
    }

    protected override requiresApiKey(): boolean {
      return options.requiresApiKey ?? super.requiresApiKey();
    }
  };
}

export function createAnthropicProvider(
  id: ProviderId,
  options: ProviderFactoryOptions = {},
): ProviderConstructor {
  return class ConfiguredAnthropicProvider extends AnthropicMessagesTransport {
    get id() {
      return id;
    }

    get label() {
      return PROVIDER_LABELS[id];
    }

    protected override authHeaders(): Record<string, string> {
      if (options.authHeaderStyle === "x-api-key") {
        return { "x-api-key": this.config.apiKey ?? "" };
      }
      return super.authHeaders();
    }

    protected override extraHeaders(): Record<string, string> {
      return options.extraHeaders ?? {};
    }

    protected override requiresApiKey(): boolean {
      return options.requiresApiKey ?? super.requiresApiKey();
    }
  };
}
