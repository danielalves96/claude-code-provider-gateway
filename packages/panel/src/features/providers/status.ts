import { LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "./constants.js";
import type { ProviderInfo } from "./types.js";

export function getProviderKind(provider: ProviderInfo) {
  if (LOCAL_PROVIDERS.has(provider.id)) return "local";
  if (OAUTH_PROVIDERS.has(provider.id)) return "oauth";
  return "api-key";
}

export function isProviderReady(provider: ProviderInfo) {
  const kind = getProviderKind(provider);
  if (kind === "local") return true;
  if (kind === "oauth") return provider.oauth?.loggedIn === true;
  return provider.hasKey;
}

export function canTestProvider(provider: ProviderInfo) {
  return provider.enabled && isProviderReady(provider);
}
