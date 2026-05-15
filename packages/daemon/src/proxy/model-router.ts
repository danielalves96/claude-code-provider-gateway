import type { Config, ProviderId, RoutingRule } from "../config/schema.js";
import { PROVIDER_IDS } from "../config/schema.js";

export interface ResolvedModel {
  providerId: ProviderId;
  providerModel: string;
  /** How the model was resolved — used by the service layer to detect background passthrough calls */
  source: "prefix" | "tier" | "passthrough";
}

const CLAUDE_OPUS_PATTERN = /claude-(3-opus|opus)/i;
const CLAUDE_SONNET_PATTERN = /claude-(3[.-]5?-sonnet|sonnet)/i;
const CLAUDE_HAIKU_PATTERN = /claude-(3-haiku|haiku)/i;

function applyRule(rule: RoutingRule | undefined): ResolvedModel | null {
  if (!rule || !rule.enabled || !rule.providerId || !rule.model) return null;

  // Normalize the stored model name: the panel lets users pick models by their full
  // gateway ID (e.g. "anthropic/deepseek/deepseek-v4-flash"), but only the bare
  // provider model name ("deepseek-v4-flash") should be sent to the provider API.
  let providerModel = rule.model;
  if (providerModel.startsWith("anthropic/")) {
    providerModel = providerModel.slice("anthropic/".length);
  }
  // After stripping the gateway prefix we may have "<providerId>/<model>" — strip that too.
  if (providerModel.startsWith(`${rule.providerId}/`)) {
    providerModel = providerModel.slice(rule.providerId.length + 1);
  }

  return { providerId: rule.providerId as ProviderId, providerModel, source: "tier" as const };
}

export function resolveModel(requestedModel: string, config: Config): ResolvedModel {
  // Strip Claude Code-discoverable prefix: "anthropic/<provider>/<model>"
  let model = requestedModel;
  if (model.startsWith("anthropic/")) {
    model = model.slice("anthropic/".length);
  }

  // Direct provider/model syntax: "nvidia_nim/z-ai/glm4.7"
  for (const pid of PROVIDER_IDS) {
    if (model.startsWith(`${pid}/`)) {
      return { providerId: pid, providerModel: model.slice(pid.length + 1), source: "prefix" };
    }
  }
  const requestedForTier = requestedModel;

  // Claude model tier mapping (only when the rule is explicitly enabled)
  let tierRule: RoutingRule | undefined;
  if (CLAUDE_OPUS_PATTERN.test(requestedForTier)) tierRule = config.routing.opus;
  else if (CLAUDE_SONNET_PATTERN.test(requestedForTier)) tierRule = config.routing.sonnet;
  else if (CLAUDE_HAIKU_PATTERN.test(requestedForTier)) tierRule = config.routing.haiku;

  const tierResolved = applyRule(tierRule);
  if (tierResolved) return { ...tierResolved, source: "tier" };

  const defaultResolved = applyRule(config.routing.default);
  if (defaultResolved) return { ...defaultResolved, source: "tier" };

  // Passthrough: routing not configured → send the original model name to the active provider
  return {
    providerId: config.activeProvider,
    providerModel: requestedModel,
    source: "passthrough",
  };
}
