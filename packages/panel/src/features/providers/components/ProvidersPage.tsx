import { Flex, Typography, theme } from "antd";
import { useCallback, useState } from "react";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useOAuth } from "../hooks/useOAuth.js";
import { useProviders } from "../hooks/useProviders.js";
import type { ConfirmAction } from "../types.js";
import { ConfirmModal } from "./ConfirmModal.js";
import { ProviderConfigModal, type ProviderConfigModalHandlers } from "./ProviderConfigModal.js";
import { groupProvidersByConfiguration, ProviderGridSection } from "./ProviderGridSection.js";

const { Text } = Typography;

export default function ProvidersPage() {
  const { token } = theme.useToken();
  const providersApi = useProviders();
  const oauth = useOAuth({ onSuccess: providersApi.refresh });
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

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

  const providerGroups = groupProvidersByConfiguration(providersApi.providers);
  const activeProvider = selectedProviderId
    ? (providersApi.providers.find((provider) => provider.id === selectedProviderId) ?? null)
    : null;

  return (
    <Flex vertical gap={token.paddingLG}>
      <ProvidersHeader />

      {providerGroups.map((group) => (
        <ProviderGridSection
          key={group.title}
          title={group.title}
          providers={group.providers}
          testResults={providersApi.testResults}
          onProviderSelect={(provider) => setSelectedProviderId(provider.id)}
          onToggleEnabled={providersApi.toggleEnabled}
        />
      ))}

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
