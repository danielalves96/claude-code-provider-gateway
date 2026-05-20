import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Flex, Tabs, Typography, theme } from "antd";
import { PageHeader } from "../../../../shared/components/PageHeader.js";
import { useProvidersPage } from "../../hooks/useProvidersPage.js";
import { AddCustomProviderModal } from "../config/AddCustomProviderModal.js";
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
  const openCustomProviderModal = (compatibility: "openai" | "anthropic") => {
    page.setCustomCompatibility(compatibility);
    page.setAddCustomOpen(true);
  };

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
        tabBarExtraContent={
          <Flex gap={token.paddingXS} wrap>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCustomProviderModal("anthropic")}
            >
              Add Anthropic Compatible
            </Button>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => openCustomProviderModal("openai")}
            >
              Add OpenAI Compatible
            </Button>
          </Flex>
        }
        items={[
          {
            key: "all",
            label: "All Providers",
            children: page.providersApi.isLoading ? (
              <ProviderGridSkeleton />
            ) : (
              <AllProvidersTab
                groups={page.providerGroups}
                customProviders={page.customProviders}
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

      <AddCustomProviderModal
        open={page.addCustomOpen}
        testing={page.providersApi.testing === "custom-provider"}
        compatibility={page.customCompatibility}
        onCancel={() => page.setAddCustomOpen(false)}
        onTest={page.providersApi.testCustom}
        onCreate={page.providersApi.createCustom}
        onCreated={(id) => {
          page.setAddCustomOpen(false);
          page.setSelectedProviderId(id);
        }}
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
