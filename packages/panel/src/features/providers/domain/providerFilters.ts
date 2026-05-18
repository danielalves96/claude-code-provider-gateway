import type { ProviderInfo } from "./types.js";

export type ProviderStatusFilter = "all" | "active" | "inactive";

export interface ProviderFilters {
  searchTerm: string;
  status: ProviderStatusFilter;
}

export const PROVIDER_STATUS_OPTIONS: Array<{ label: string; value: ProviderStatusFilter }> = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export function filterProviders(
  providers: ProviderInfo[],
  filters: ProviderFilters,
): ProviderInfo[] {
  const query = filters.searchTerm.trim().toLowerCase();

  return providers.filter((provider) => {
    if (query && !provider.label.toLowerCase().includes(query)) {
      return false;
    }

    return matchesStatusFilter(provider, filters.status);
  });
}

function matchesStatusFilter(provider: ProviderInfo, status: ProviderStatusFilter): boolean {
  if (status === "active") return provider.enabled;
  if (status === "inactive") return !provider.enabled;
  return true;
}
