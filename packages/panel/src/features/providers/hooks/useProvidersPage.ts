import type { MessageInstance } from "antd/es/message/interface.js";
import { useCallback, useMemo, useState } from "react";
import type { ProviderConfigModalHandlers } from "../components/config/ProviderConfigModal.js";
import { filterProviders, type ProviderStatusFilter } from "../domain/providerFilters.js";
import { groupProvidersByConfiguration } from "../domain/providerGroups.js";
import type { ConfirmAction } from "../domain/types.js";
import { useFavorites } from "./useFavorites.js";
import { useOAuth } from "./useOAuth.js";
import { useProviders } from "./useProviders.js";

interface UseProvidersPageOptions {
  message: MessageInstance;
}

export function useProvidersPage({ message }: UseProvidersPageOptions) {
  const providersApi = useProviders();
  const oauth = useOAuth({ onSuccess: providersApi.refresh });
  const favoritesApi = useFavorites();

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [addCustomOpen, setAddCustomOpen] = useState(false);
  const [customCompatibility, setCustomCompatibility] = useState<"openai" | "anthropic">("openai");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProviderStatusFilter>("all");

  const filteredProviders = useMemo(() => {
    return filterProviders(providersApi.providers, {
      searchTerm,
      status: statusFilter,
    });
  }, [providersApi.providers, searchTerm, statusFilter]);

  const providerGroups = useMemo(
    () => groupProvidersByConfiguration(filteredProviders),
    [filteredProviders],
  );

  const customProviders = useMemo(
    () => filteredProviders.filter((provider) => provider.custom),
    [filteredProviders],
  );

  const activeProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providersApi.providers.find((provider) => provider.id === selectedProviderId) ?? null;
  }, [providersApi.providers, selectedProviderId]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      favoritesApi.toggleFavorite(id);
      if (!favoritesApi.favorites.includes(id)) {
        message.success("Added to favorites");
      } else {
        message.info("Removed from favorites");
      }
    },
    [favoritesApi, message],
  );

  const handleReorderFavorites = useCallback(
    (newOrder: string[]) => {
      favoritesApi.reorderFavorites(newOrder);
      message.success("Favorites reordered");
    },
    [favoritesApi, message],
  );

  const runConfirmed = useCallback(async () => {
    if (!confirm) return;

    switch (confirm.kind) {
      case "replace-key":
        await providersApi.saveKey(confirm.providerId, confirm.newValue);
        break;
      case "remove-key":
        await providersApi.removeKey(confirm.providerId);
        break;
      case "change-url":
        await providersApi.saveBaseUrl(confirm.providerId, confirm.newValue);
        break;
      case "delete-provider":
        await providersApi.deleteCustom(confirm.providerId);
        setSelectedProviderId(null);
        break;
    }

    setConfirm(null);
  }, [confirm, providersApi]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
  }, []);

  const closeProviderModal = useCallback(() => {
    setSelectedProviderId(null);
  }, []);

  const modalHandlers: ProviderConfigModalHandlers = useMemo(
    () => ({
      onTest: providersApi.test,
      onSaveKey: providersApi.saveKey,
      onRequestReplaceKey: (providerId, newValue) =>
        setConfirm({ kind: "replace-key", providerId, newValue }),
      onRequestRemoveKey: (providerId) => setConfirm({ kind: "remove-key", providerId }),
      onRequestChangeUrl: (providerId, newValue) =>
        setConfirm({ kind: "change-url", providerId, newValue }),
      onRequestDeleteProvider: (providerId) => setConfirm({ kind: "delete-provider", providerId }),
      onAddModel: providersApi.addModel,
      onRemoveModel: providersApi.removeModel,
      onDisabledModelsChange: providersApi.setDisabledModels,
      onRuntimeLimitsChange: providersApi.setRuntimeLimits,
      onOAuthLogin: oauth.start,
      onOAuthLogout: oauth.logout,
      onCancelOAuthFlow: oauth.cancel,
    }),
    [providersApi, oauth],
  );

  return {
    providersApi,
    oauth,
    favoritesApi,
    confirm,
    activeProvider,
    filteredProviders,
    providerGroups,
    customProviders,
    searchTerm,
    statusFilter,
    modalHandlers,
    addCustomOpen,
    customCompatibility,
    setSearchTerm,
    setStatusFilter,
    setSelectedProviderId,
    setAddCustomOpen,
    setCustomCompatibility,
    setConfirm,
    resetFilters,
    closeProviderModal,
    runConfirmed,
    handleToggleFavorite,
    handleReorderFavorites,
  };
}
