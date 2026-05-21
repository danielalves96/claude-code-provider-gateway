import type { BuiltInProviderId, Config, ProviderConfig } from "../../config/schema.js";
import { PROVIDER_LABELS } from "../../config/schema.js";
import type { BaseProvider } from "./shared/index.js";
import { OAuthStubProvider } from "./shared/index.js";
import { fetchProviderJson, mapProviderModels } from "./shared/api-client.js";
import { AnthropicMessagesTransport, OpenAIChatTransport } from "./transports/index.js";

type ProviderConstructor = new (config: ProviderConfig, rootConfig: Config) => BaseProvider;

interface ProviderFactoryOptions {
  authHeaderStyle?: "bearer" | "x-api-key";
  extraHeaders?: Record<string, string>;
  listModelsBaseUrl?: (baseUrl: string) => string;
  normalizeBaseUrl?: (baseUrl: string) => string;
  requiresApiKey?: boolean;
}

export function createOpenAIProvider(
  id: BuiltInProviderId,
  options: ProviderFactoryOptions = {},
): ProviderConstructor {
  return class ConfiguredOpenAIProvider extends OpenAIChatTransport {
    get id() {
      return id;
    }

    get label() {
      return PROVIDER_LABELS[id];
    }

    protected override baseUrl(): string {
      const baseUrl = super.baseUrl();
      return options.normalizeBaseUrl ? options.normalizeBaseUrl(baseUrl) : baseUrl;
    }

    override async listModels() {
      if (!options.listModelsBaseUrl) return super.listModels();
      const json = await fetchProviderJson<{
        data?: Array<{ id: string; name?: string; created?: number }>;
      }>({
        url: `${options.listModelsBaseUrl(this.baseUrl()).replace(/\/$/, "")}/models`,
        headers: { Authorization: this.authHeader(), ...this.extraHeaders() },
        timeoutMs: this.requestTimeoutMs(),
      });
      return mergeDiscoveredAndConfiguredModels(this.id, this.label, json.data ?? [], this.config.models);
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
  id: BuiltInProviderId,
  options: ProviderFactoryOptions = {},
): ProviderConstructor {
  return class ConfiguredAnthropicProvider extends AnthropicMessagesTransport {
    get id() {
      return id;
    }

    get label() {
      return PROVIDER_LABELS[id];
    }

    protected override baseUrl(): string {
      const baseUrl = super.baseUrl();
      return options.normalizeBaseUrl ? options.normalizeBaseUrl(baseUrl) : baseUrl;
    }

    override async listModels() {
      if (!options.listModelsBaseUrl) return super.listModels();
      const json = await fetchProviderJson<{
        data?: Array<{ id: string; name?: string; created?: number }>;
      }>({
        url: `${options.listModelsBaseUrl(this.baseUrl()).replace(/\/$/, "")}/models`,
        headers: { ...this.authHeaders(), ...this.extraHeaders() },
        timeoutMs: this.requestTimeoutMs(),
      });
      return mergeDiscoveredAndConfiguredModels(this.id, this.label, json.data ?? [], this.config.models);
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

export function createOAuthStubProvider(id: BuiltInProviderId): ProviderConstructor {
  return class ConfiguredOAuthStubProvider extends OAuthStubProvider {
    get id() {
      return id;
    }

    get label() {
      return PROVIDER_LABELS[id];
    }
  };
}

function mergeDiscoveredAndConfiguredModels(
  providerId: string,
  providerLabel: string,
  providerModels: Array<{ id: string; name?: string; created?: number }>,
  configuredModels: string[] | undefined,
) {
  const discovered = mapProviderModels(providerModels, providerId, providerLabel);
  const discoveredIds = new Set(discovered.map((m) => m.id));
  const extra = (configuredModels ?? [])
    .filter((id) => !discoveredIds.has(`anthropic/${providerId}/${id}`))
    .map((id) => ({
      type: "model" as const,
      id: `anthropic/${providerId}/${id}`,
      display_name: `${providerLabel} · ${id}`,
      created_at: new Date(0).toISOString(),
    }));
  return [...discovered, ...extra];
}
