import { http } from "../../../shared/api/http.js";
import type { ModelFallbackConfig, RoutingOption } from "../domain/types.js";

type ConfigResponse = {
  modelFallbacks: ModelFallbackConfig[];
  activeModelFallbackSlug: string | null;
};

export const modelChainService = {
  getConfig: () => http.get<ConfigResponse>("/config"),
  getOptions: () => http.get<RoutingOption[]>("/routing/options"),
  save: (modelFallbacks: ModelFallbackConfig[]) => http.put<unknown>("/config", { modelFallbacks }),
};
