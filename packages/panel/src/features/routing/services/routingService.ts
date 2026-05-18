import { http } from "../../../shared/api/http.js";
import type { RoutingConfig, RoutingMap, RoutingOption } from "../domain/types.js";

export const routingService = {
  getConfig: () => http.get<RoutingConfig>("/config"),
  getOptions: () => http.get<RoutingOption[]>("/routing/options"),
  save: (routing: RoutingMap, thinking: boolean) =>
    http.put<unknown>("/config", { routing, thinking: { enabled: thinking } }),
};
