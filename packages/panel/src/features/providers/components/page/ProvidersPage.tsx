import { App, Flex, Tabs, Typography, theme } from "antd";
import { PageHeader } from "../../../../shared/components/PageHeader.js";
import { useProvidersPage } from "../../hooks/useProvidersPage.js";
import { ConfirmModal } from "../config/ConfirmModal.js";
import { ProviderConfigModal } from "../config/ProviderConfigModal.js";
import { ProviderGridSkeleton } from "../grid/ProviderCardSkeleton.js";
import { AllProvidersTab, FavoritesTab } from "./ProviderTabs.js";
import { ProviderToolbar } from "./ProviderToolbar.js";

const { Text } = Typography;

export default function ProvidersPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const page = useProvidersPage({ message });

  return (
    <Flex vertical gap={token.paddingLG}>
      <ProvidersHeader />

      <ProviderToolbar
        searchTerm={page.searchTerm}
        statusFilter={page.statusFilter}
        onSearchTermChange={page.setSearchTerm}
        onStatusFilterChange={page.setStatusFilter}
      />

      <Tabs
        defaultActiveKey="all"
        onChange={page.resetFilters}
        items={[
          {
            key: "all",
            label: "All Providers",
            children: page.providersApi.isLoading ? (
              <ProviderGridSkeleton />
            ) : (
              <AllProvidersTab
                groups={page.providerGroups}
                testResults={page.providersApi.testResults}
                favorites={page.favoritesApi.favorites}
                onProviderSelect={page.setSelectedProviderId}
                onToggleEnabled={page.providersApi.toggleEnabled}
                onToggleFavorite={page.handleToggleFavorite}
              />
            ),
          },
          {
            key: "favorites",
            label: "Favorites",
            children: (
              <FavoritesTab
                favorites={page.favoritesApi.favorites}
                providers={page.filteredProviders}
                testResults={page.providersApi.testResults}
                tipDismissed={page.favoritesApi.tipDismissed}
                onProviderSelect={page.setSelectedProviderId}
                onToggleEnabled={page.providersApi.toggleEnabled}
                onToggleFavorite={page.handleToggleFavorite}
                onReorder={page.handleReorderFavorites}
                onDismissTip={page.favoritesApi.dismissTip}
              />
            ),
          },
        ]}
      />

      <ProviderConfigModal
        provider={page.activeProvider}
        open={!!page.activeProvider}
        onClose={page.closeProviderModal}
        testing={page.activeProvider ? page.providersApi.testing === page.activeProvider.id : false}
        oauthBusyFor={page.oauth.busy}
        oauthError={page.oauth.error}
        copilotFlow={page.oauth.copilotFlow}
        handlers={page.modalHandlers}
        onToggleEnabled={page.providersApi.toggleEnabled}
      />

      <ConfirmModal
        action={page.confirm}
        providers={page.providersApi.providers}
        onCancel={() => page.setConfirm(null)}
        onConfirm={page.runConfirmed}
      />
    </Flex>
  );
}

function ProvidersHeader() {
  return (
    <div>
      <PageHeader title="Providers" />
      <Text type="secondary" style={{ marginTop: 8, display: "block" }}>
        Select a provider card below to configure API keys, custom URLs, and active models.
      </Text>
    </div>
  );
}
