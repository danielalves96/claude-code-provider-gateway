import type { ModelsListResponse } from "../../core/anthropic/types.js";
import type { ProxyRuntime } from "../runtime.js";

export class ModelService {
  constructor(private readonly runtime: ProxyRuntime) {}

  async listModels(): Promise<ModelsListResponse> {
    const config = this.runtime.currentConfig();
    const registry = this.runtime.providers();
    const mode = config.modelMode ?? "single";
    const activeChainSlug = config.activeModelFallbackSlug;

    // Native Claude tiers (Default/Sonnet/Haiku) are NOT advertised here on purpose.
    // Claude Code's /model picker already injects them from its own hardcoded list,
    // and message-service intercepts those model names before routing — adding them
    // here would duplicate every native Claude entry as a redundant "From gateway" row.
    if (activeChainSlug || mode === "chains") {
      const advertised = this.listChainModels(activeChainSlug ?? undefined);
      return {
        data: advertised,
        has_more: false,
        first_id: advertised[0]?.id ?? null,
        last_id: advertised[advertised.length - 1]?.id ?? null,
      };
    }

    const data =
      mode === "all"
        ? (
            await Promise.all(
              registry.all().map(({ provider }) => provider.listEnabledModels().catch(() => [])),
            )
          ).flat()
        : await this.listActiveProviderModels();
    const fallbackModels = this.listChainModels();
    const advertised = [...fallbackModels, ...data];

    return {
      data: advertised,
      has_more: false,
      first_id: advertised[0]?.id ?? null,
      last_id: advertised[advertised.length - 1]?.id ?? null,
    };
  }

  private listChainModels(slug?: string) {
    const config = this.runtime.currentConfig();
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

  private async listActiveProviderModels() {
    const provider = this.runtime.providers().getActive();
    return provider ? await provider.listEnabledModels().catch(() => []) : [];
  }
}
