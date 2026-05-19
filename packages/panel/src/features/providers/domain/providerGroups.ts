import { COMING_SOON_PROVIDERS, LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "./constants.js";
import type { ProviderInfo } from "./types.js";

export type ProviderGroup = {
  title: string;
  providers: ProviderInfo[];
};

export function groupProvidersByConfiguration(providers: ProviderInfo[]): ProviderGroup[] {
  return [
    {
      title: "Local Providers",
      providers: sortProvidersByLabel(
        providers.filter((provider) => LOCAL_PROVIDERS.has(provider.id)),
      ),
    },
    {
      title: "OAuth Providers",
      providers: sortProvidersByLabel(
        providers.filter((provider) => OAUTH_PROVIDERS.has(provider.id)),
      ),
    },
    {
      title: "API Key Providers",
      providers: sortProvidersByLabel(providers.filter((provider) => isApiKeyProvider(provider))),
    },
  ].filter((group) => group.providers.length > 0);
}

function isApiKeyProvider(provider: ProviderInfo): boolean {
  return !LOCAL_PROVIDERS.has(provider.id) && !OAUTH_PROVIDERS.has(provider.id);
}

function sortProvidersByLabel(providers: ProviderInfo[]): ProviderInfo[] {
  return [...providers].sort(
    (a, b) =>
      Number(COMING_SOON_PROVIDERS.has(a.id)) - Number(COMING_SOON_PROVIDERS.has(b.id)) ||
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
}
