import type { Config, ProviderId } from "../../config/schema.js";
import { isNativeClaudeModel } from "../providers/anthropic-passthrough.js";

type SessionPrimaryModel = { providerId: ProviderId; providerModel: string } | null;

export function shouldUseNativeClaudePassthrough(
  requestedModel: string,
  config: Config,
  primaryModel: SessionPrimaryModel,
): boolean {
  if (!isNativeClaudeModel(requestedModel)) return false;
  if (primaryModel) return false;

  // A ccpg provider launch means Claude Code's hardcoded claude-haiku background
  // calls should inherit the gateway route instead of silently hitting Anthropic.
  // This applies to --all too: once the user picks a provider-prefixed model, the
  // primary model below takes over; before that, the active/default route is safer
  // than api.anthropic.com surprises.
  const activeProviderEnabled = config.providers[config.activeProvider]?.enabled === true;
  return !activeProviderEnabled;
}
