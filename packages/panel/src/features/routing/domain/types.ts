import type { RoutingRule, RoutingTier } from "../../../../../daemon/src/config/schema.js";
import type {
  RoutingConfigResponse,
  RoutingOption,
} from "../../../../../daemon/src/panel/contracts.js";

export type Tier = RoutingTier;

export type RoutingMap = Record<Tier, RoutingRule>;
export type RoutingConfig = RoutingConfigResponse;
export type { RoutingOption, RoutingRule };
