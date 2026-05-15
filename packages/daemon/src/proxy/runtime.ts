import { loadConfig } from "../config/index.js";
import type { Config } from "../config/schema.js";
import { ProviderRegistry } from "./providers/registry.js";

export type ConfigLoader = () => Config;

export class ProxyRuntime {
  private config: Config;
  private readonly registry: ProviderRegistry;

  constructor(
    initialConfig: Config,
    private readonly load: ConfigLoader = loadConfig,
  ) {
    this.config = initialConfig;
    this.registry = new ProviderRegistry(initialConfig);
  }

  currentConfig(): Config {
    return this.config;
  }

  providers(): ProviderRegistry {
    return this.registry;
  }

  reloadConfig(): void {
    this.config = this.load();
    this.registry.updateConfig(this.config);
  }
}
