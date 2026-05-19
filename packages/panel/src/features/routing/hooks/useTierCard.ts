import type { GlobalToken } from "antd/es/theme/interface";
import { TIER_META } from "../domain/constants.js";
import type { RoutingOption, RoutingRule, Tier } from "../domain/types.js";

interface UseTierCardOptions {
  tier: Tier;
  rule: RoutingRule;
  options: RoutingOption[];
}

export function useTierCard({ tier, rule, options }: UseTierCardOptions) {
  const provider = options.find((option) => option.id === rule.providerId);
  const modelOptions =
    provider?.models.map((model) => ({
      value: model.id,
      label: model.display_name,
    })) ?? [];
  const modelMissing =
    !!rule.providerId &&
    !!rule.model &&
    provider !== undefined &&
    !provider.models.some((model) => model.id === rule.model);

  if (modelMissing) {
    modelOptions.push({
      value: rule.model,
      label: `${rule.model} (not in enabled list)`,
    });
  }

  return {
    meta: TIER_META[tier],
    provider,
    modelOptions,
    modelMissing,
    canEnable: provider !== undefined && !!rule.providerId && !!rule.model && !modelMissing,
    isEnabled: rule.enabled,
  };
}

export function getTierGlowColor(tier: Tier, token: GlobalToken): string {
  switch (tier) {
    case "opus":
      return "#722ed1";
    case "sonnet":
      return "#1677ff";
    case "haiku":
      return "#13c2c2";
    default:
      return token.colorTextSecondary;
  }
}
