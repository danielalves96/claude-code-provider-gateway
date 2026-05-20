import { Alert, Col, Empty, Flex, Row, Typography, theme } from "antd";
import type { ProviderGroup } from "../../domain/providerGroups.js";
import type { ProviderInfo, TestResult } from "../../domain/types.js";
import { ProviderCard } from "../grid/ProviderCard.js";
import { ProviderGridSection } from "../grid/ProviderGridSection.js";
import { SortableFavoritesGrid } from "../grid/SortableFavoritesGrid.js";

interface AllProvidersTabProps {
  groups: ProviderGroup[];
  customProviders: ProviderInfo[];
  testResults: Record<string, TestResult>;
  favorites: string[];
  onProviderSelect: (providerId: string) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (providerId: string) => void;
}

export function AllProvidersTab({
  groups,
  customProviders,
  testResults,
  favorites,
  onProviderSelect,
  onToggleEnabled,
  onToggleFavorite,
}: AllProvidersTabProps) {
  const { token } = theme.useToken();

  if (groups.length === 0 && customProviders.length === 0) {
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
      <CustomProvidersSection
        providers={customProviders}
        testResults={testResults}
        favorites={favorites}
        onProviderSelect={(provider) => onProviderSelect(provider.id)}
        onToggleEnabled={onToggleEnabled}
        onToggleFavorite={(provider) => onToggleFavorite(provider.id)}
      />
    </Flex>
  );
}

function CustomProvidersSection({
  providers,
  testResults,
  favorites,
  onProviderSelect,
  onToggleEnabled,
  onToggleFavorite,
}: {
  providers: ProviderInfo[];
  testResults: Record<string, TestResult>;
  favorites: string[];
  onProviderSelect: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  onToggleFavorite: (provider: ProviderInfo, event: React.MouseEvent) => void;
}) {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={token.paddingSM}>
      <Typography.Title level={5} style={{ margin: 0, fontWeight: 600 }}>
        Custom Providers (OpenAI/Anthropic Compatible)
      </Typography.Title>

      {providers.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: token.borderRadiusLG,
            color: token.colorTextSecondary,
            padding: `${token.paddingSM}px ${token.paddingMD}px`,
            textAlign: "center",
          }}
        >
          No custom providers. Use the tab actions above to add OpenAI or Anthropic compatible
          endpoints.
        </div>
      ) : (
        <Row gutter={[token.paddingMD, token.paddingMD]} align="stretch">
          {providers.map((provider) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={provider.id}>
              <ProviderCard
                provider={provider}
                testResult={testResults[provider.id]}
                onClick={onProviderSelect}
                onToggleEnabled={onToggleEnabled}
                isFavorite={favorites.includes(provider.id)}
                onToggleFavorite={onToggleFavorite}
              />
            </Col>
          ))}
        </Row>
      )}
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
