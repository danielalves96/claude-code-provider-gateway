import type { RoutingRule, Tier } from "./types.js";

export const TIERS: Tier[] = ["default", "opus", "sonnet", "haiku"];

export const TIER_META: Record<Tier, { color: string; description: string }> = {
  default: {
    color: "default",
    description: "Catch-all — no tier-specific rule matches",
  },
  opus: { color: "purple", description: "Overrides claude-opus-* requests" },
  sonnet: { color: "blue", description: "Overrides claude-sonnet-* requests" },
  haiku: { color: "cyan", description: "Overrides claude-haiku-* requests" },
};

export const EMPTY_RULE: RoutingRule = {
  enabled: false,
  providerId: "",
  model: "",
};
