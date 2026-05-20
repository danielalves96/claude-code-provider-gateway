import type { ProviderConfig } from "../../../../../daemon/src/config/schema.js";
import { http } from "../../../shared/api/http.js";
import type { ModelFallbackConfig, RoutingOption } from "../domain/types.js";

type ConfigResponse = {
  modelFallbacks: ModelFallbackConfig[];
  activeModelFallbackSlug: string | null;
  providers: Record<string, ProviderConfig>;
};

export const modelChainService = {
  getConfig: () => http.get<ConfigResponse>("/config"),
  getOptions: () => http.get<RoutingOption[]>("/routing/options"),
  save: (modelFallbacks: ModelFallbackConfig[]) => http.put<unknown>("/config", { modelFallbacks }),
};
