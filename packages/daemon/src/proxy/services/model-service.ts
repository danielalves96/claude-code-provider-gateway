import type { Config } from "../../config/schema.js";
import type { ModelsListResponse } from "../../core/anthropic/types.js";
import type { ProxyRuntime } from "../runtime.js";

export class ModelService {
  constructor(private readonly runtime: ProxyRuntime) {}

  async listModels(config = this.runtime.currentConfig()): Promise<ModelsListResponse> {
    const registry = this.runtime.providers();
    const mode = config.modelMode ?? "single";
    const activeChainSlug = config.activeModelFallbackSlug;

    // Native Claude tiers (Default/Sonnet/Haiku) are NOT advertised here on purpose.
    // Claude Code's /model picker already injects them from its own hardcoded list,
    // and message-service intercepts those model names before routing — adding them
    // here would duplicate every native Claude entry as a redundant "From gateway" row.
    if (activeChainSlug || mode === "chains") {
      const advertised = this.listChainModels(activeChainSlug ?? undefined, config);
      return {
        data: advertised,
        has_more: false,
        first_id: advertised[0]?.id ?? null,
        last_id: advertised[advertised.length - 1]?.id ?? null,
      };
    }

    const data =
      mode === "all"
        ? [
            ...this.listChainModels(undefined, config),
            ...(
              await Promise.all(
                Object.keys(config.providers)
                  .filter((id) => config.providers[id]?.enabled)
                  .map(
                    (id) =>
                      registry
                        .get(id)
                        ?.listEnabledModels()
                        .catch(() => []) ?? [],
                  ),
              )
            ).flat(),
          ]
        : await this.listActiveProviderModels(config);

    return {
      data,
      has_more: false,
      first_id: data[0]?.id ?? null,
      last_id: data[data.length - 1]?.id ?? null,
    };
  }

  private listChainModels(slug?: string, config = this.runtime.currentConfig()) {
    return config.modelFallbacks
      .filter((fallback) => fallback.enabled && fallback.models.length > 0)
      .filter((fallback) => !slug || fallback.slug === slug)
      .map((fallback) => ({
        type: "model" as const,
        id: `anthropic/chain/${fallback.slug}`,
        display_name: `${fallback.name} · Gateway:custom-model (Defined by user)`,
        created_at: new Date(0).toISOString(),
      }));
  }

  private async listActiveProviderModels(config: Config) {
    const provider = this.runtime.providers().get(config.activeProvider);
    return provider ? await provider.listEnabledModels().catch(() => []) : [];
  }
}
