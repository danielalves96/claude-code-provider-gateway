import { Alert, Empty, Flex, theme } from "antd";
import type { ProviderGroup } from "../../domain/providerGroups.js";
import type { ProviderInfo, TestResult } from "../../domain/types.js";
import { ProviderGridSection } from "../grid/ProviderGridSection.js";
import { SortableFavoritesGrid } from "../grid/SortableFavoritesGrid.js";

interface AllProvidersTabProps {
  groups: ProviderGroup[];
  testResults: Record<string, TestResult>;
  favorites: string[];
  onProviderSelect: (providerId: string) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (providerId: string) => void;
}

export function AllProvidersTab({
  groups,
  testResults,
  favorites,
  onProviderSelect,
  onToggleEnabled,
  onToggleFavorite,
}: AllProvidersTabProps) {
  const { token } = theme.useToken();

  if (groups.length === 0) {
    return (
      <Empty description="No providers found matching your filters" style={{ margin: "40px 0" }} />
    );
  }

  return (
    <Flex vertical gap={token.paddingLG}>
      {groups.map((group) => (
        <ProviderGridSection
          key={group.title}
          title={group.title}
          providers={group.providers}
          testResults={testResults}
          onProviderSelect={(provider) => onProviderSelect(provider.id)}
          onToggleEnabled={onToggleEnabled}
          favorites={favorites}
          onToggleFavorite={(provider) => onToggleFavorite(provider.id)}
        />
      ))}
    </Flex>
  );
}

interface FavoritesTabProps {
  favorites: string[];
  providers: ProviderInfo[];
  testResults: Record<string, TestResult>;
  tipDismissed: boolean;
  onProviderSelect: (providerId: string) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (providerId: string) => void;
  onReorder: (ids: string[]) => void;
  onDismissTip: () => void;
}

export function FavoritesTab({
  favorites,
  providers,
  testResults,
  tipDismissed,
  onProviderSelect,
  onToggleEnabled,
  onToggleFavorite,
  onReorder,
  onDismissTip,
}: FavoritesTabProps) {
  const { token } = theme.useToken();

  if (favorites.length === 0) {
    return (
      <Empty
        description="No favorite providers yet. Star some providers from the All Providers tab!"
        style={{ margin: "40px 0" }}
      />
    );
  }

  const hasVisibleFavorites = favorites.some((id) =>
    providers.some((provider) => provider.id === id),
  );

  return (
    <Flex vertical gap={token.paddingLG}>
      {!tipDismissed && (
        <Alert
          message="Tip: You can drag and drop cards to reorganize your favorites."
          type="info"
          showIcon
          closable
          onClose={onDismissTip}
        />
      )}
      {hasVisibleFavorites ? (
        <SortableFavoritesGrid
          favoriteIds={favorites}
          providers={providers}
          testResults={testResults}
          onProviderSelect={(provider) => onProviderSelect(provider.id)}
          onToggleEnabled={onToggleEnabled}
          onToggleFavorite={(provider) => onToggleFavorite(provider.id)}
          onReorder={onReorder}
        />
      ) : (
        <Empty
          description="No favorite providers found matching your filters"
          style={{ margin: "40px 0" }}
        />
      )}
    </Flex>
  );
}
