import { SearchOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Flex, Input, Select, Tabs, Typography, theme } from "antd";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useFavorites } from "../hooks/useFavorites.js";
import { useOAuth } from "../hooks/useOAuth.js";
import { useProviders } from "../hooks/useProviders.js";
import type { ConfirmAction } from "../types.js";
import { ConfirmModal } from "./ConfirmModal.js";
import { ProviderConfigModal, type ProviderConfigModalHandlers } from "./ProviderConfigModal.js";
import { groupProvidersByConfiguration, ProviderGridSection } from "./ProviderGridSection.js";
import { SortableFavoritesGrid } from "./SortableFavoritesGrid.js";

const { Text } = Typography;

export default function ProvidersPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const providersApi = useProviders();
  const oauth = useOAuth({ onSuccess: providersApi.refresh });
  const { favorites, tipDismissed, toggleFavorite, reorderFavorites, dismissTip } = useFavorites();

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
      if (!favorites.includes(id)) {
        message.success("Added to favorites");
      } else {
        message.info("Removed from favorites");
      }
    },
    [toggleFavorite, favorites, message],
  );

  const handleReorderFavorites = useCallback(
    (newOrder: string[]) => {
      reorderFavorites(newOrder);
      message.success("Favorites reordered");
    },
    [reorderFavorites, message],
  );

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const runConfirmed = useCallback(async () => {
    if (!confirm) return;
    if (confirm.kind === "replace-key") {
      await providersApi.saveKey(confirm.providerId, confirm.newValue);
    } else if (confirm.kind === "remove-key") {
      await providersApi.removeKey(confirm.providerId);
    } else if (confirm.kind === "change-url") {
      await providersApi.saveBaseUrl(confirm.providerId, confirm.newValue);
    }
    setConfirm(null);
  }, [confirm, providersApi]);

  const modalHandlers: ProviderConfigModalHandlers = {
    onTest: providersApi.test,
    onSaveKey: providersApi.saveKey,
    onRequestReplaceKey: (providerId, newValue) =>
      setConfirm({ kind: "replace-key", providerId, newValue }),
    onRequestRemoveKey: (providerId) => setConfirm({ kind: "remove-key", providerId }),
    onRequestChangeUrl: (providerId, newValue) =>
      setConfirm({ kind: "change-url", providerId, newValue }),
    onAddModel: providersApi.addModel,
    onRemoveModel: providersApi.removeModel,
    onDisabledModelsChange: providersApi.setDisabledModels,
    onOAuthLogin: oauth.start,
    onOAuthLogout: oauth.logout,
    onCancelOAuthFlow: oauth.cancel,
  };

  const filteredProviders = useMemo(() => {
    return providersApi.providers.filter((p) => {
      // 1. Search Filter
      if (searchTerm && !p.label.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !p.enabled) return false;
        if (statusFilter === "inactive" && p.enabled) return false;
      }

      return true;
    });
  }, [providersApi.providers, searchTerm, statusFilter]);

  const providerGroups = groupProvidersByConfiguration(filteredProviders);
  const activeProvider = selectedProviderId
    ? (providersApi.providers.find((provider) => provider.id === selectedProviderId) ?? null)
    : null;

  return (
    <Flex vertical gap={token.paddingLG}>
      <ProvidersHeader />

      <Flex gap={token.paddingSM} align="center" wrap>
        <Input
          placeholder="Search providers..."
          prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 300 }}
          allowClear
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: "All Statuses", value: "all" },
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
          style={{ width: 160 }}
        />
      </Flex>

      <Tabs
        defaultActiveKey="all"
        onChange={() => {
          setSearchTerm("");
          setStatusFilter("all");
        }}
        items={[
          {
            key: "all",
            label: "All Providers",
            children: (
              <Flex vertical gap={token.paddingLG}>
                {providerGroups.length > 0 ? (
                  providerGroups.map((group) => (
                    <ProviderGridSection
                      key={group.title}
                      title={group.title}
                      providers={group.providers}
                      testResults={providersApi.testResults}
                      onProviderSelect={(provider) => setSelectedProviderId(provider.id)}
                      onToggleEnabled={providersApi.toggleEnabled}
                      favorites={favorites}
                      onToggleFavorite={(p) => handleToggleFavorite(p.id)}
                    />
                  ))
                ) : (
                  <Empty
                    description="No providers found matching your filters"
                    style={{ margin: "40px 0" }}
                  />
                )}
              </Flex>
            ),
          },
          {
            key: "favorites",
            label: "Favorites",
            children:
              favorites.length > 0 ? (
                <Flex vertical gap={token.paddingLG}>
                  {!tipDismissed && (
                    <Alert
                      message="Tip: You can drag and drop cards to reorganize your favorites."
                      type="info"
                      showIcon
                      closable
                      onClose={dismissTip}
                    />
                  )}
                  {favorites.some((id) => filteredProviders.some((p) => p.id === id)) ? (
                    <SortableFavoritesGrid
                      favoriteIds={favorites}
                      providers={filteredProviders}
                      testResults={providersApi.testResults}
                      onProviderSelect={(provider) => setSelectedProviderId(provider.id)}
                      onToggleEnabled={providersApi.toggleEnabled}
                      onToggleFavorite={(p) => handleToggleFavorite(p.id)}
                      onReorder={handleReorderFavorites}
                    />
                  ) : (
                    <Empty
                      description="No favorite providers found matching your filters"
                      style={{ margin: "40px 0" }}
                    />
                  )}
                </Flex>
              ) : (
                <Empty
                  description="No favorite providers yet. Star some providers from the All Providers tab!"
                  style={{ margin: "40px 0" }}
                />
              ),
          },
        ]}
      />

      <ProviderConfigModal
        provider={activeProvider}
        open={!!activeProvider}
        onClose={() => setSelectedProviderId(null)}
        testing={activeProvider ? providersApi.testing === activeProvider.id : false}
        oauthBusyFor={oauth.busy}
        oauthError={oauth.error}
        copilotFlow={oauth.copilotFlow}
        handlers={modalHandlers}
        onToggleEnabled={providersApi.toggleEnabled}
      />

      <ConfirmModal
        action={confirm}
        providers={providersApi.providers}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmed}
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
