import type { ModelsListResponse } from "../../core/anthropic/types.js";
import type { ProxyRuntime } from "../runtime.js";

export class ModelService {
  constructor(private readonly runtime: ProxyRuntime) {}

  async listModels(): Promise<ModelsListResponse> {
    const config = this.runtime.currentConfig();
    const registry = this.runtime.providers();
    const mode = config.modelMode ?? "single";

    // Native Claude tiers (Default/Sonnet/Haiku) are NOT advertised here on purpose.
    // Claude Code's /model picker already injects them from its own hardcoded list,
    // and message-service intercepts those model names before routing — adding them
    // here would duplicate every native Claude entry as a redundant "From gateway" row.
    const data =
      mode === "all"
        ? (
            await Promise.all(
              registry.all().map(({ provider }) => provider.listEnabledModels().catch(() => [])),
            )
          ).flat()
        : await this.listActiveProviderModels();

    return {
      data,
      has_more: false,
      first_id: data[0]?.id ?? null,
      last_id: data[data.length - 1]?.id ?? null,
    };
  }

  private async listActiveProviderModels() {
    const provider = this.runtime.providers().getActive();
    return provider ? await provider.listEnabledModels().catch(() => []) : [];
  }
}
