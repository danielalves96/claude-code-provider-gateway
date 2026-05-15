import { Col, Flex, Row, theme } from "antd";
import { useCallback, useState } from "react";
import { PageHeader } from "../../../shared/components/PageHeader.js";
import { useOAuth } from "../hooks/useOAuth.js";
import { useProviders } from "../hooks/useProviders.js";
import { providersService } from "../providersService.js";
import type { ConfirmAction } from "../types.js";
import { ConfirmModal } from "./ConfirmModal.js";
import { ProviderCard, type ProviderCardHandlers } from "./ProviderCard.js";

export default function ProvidersPage() {
  const { token } = theme.useToken();
  const providersApi = useProviders();
  const oauth = useOAuth({ onSuccess: providersApi.refresh });
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const runConfirmed = useCallback(async () => {
    if (!confirm) return;
    if (confirm.kind === "replace-key") {
      await providersApi.saveKey(confirm.providerId, confirm.newValue);
    } else if (confirm.kind === "remove-key") {
      await providersService.removeKey(confirm.providerId);
      providersApi.refresh();
    } else if (confirm.kind === "change-url") {
      await providersApi.saveBaseUrl(confirm.providerId, confirm.newValue);
    }
    setConfirm(null);
  }, [confirm, providersApi]);

  const handlers: ProviderCardHandlers = {
    onTest: providersApi.test,
    onToggleEnabled: providersApi.toggleEnabled,
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

  return (
    <Flex vertical gap={token.paddingLG}>
      <PageHeader title="Providers" />

      <Row gutter={[token.paddingLG, token.paddingLG]} align="stretch">
        {providersApi.providers.map((p) => (
          <Col xs={24} xl={12} key={p.id} style={{ display: "flex" }}>
            <ProviderCard
              provider={p}
              testing={providersApi.testing === p.id}
              testResult={providersApi.testResults[p.id]}
              oauthBusyFor={oauth.busy}
              oauthError={oauth.error}
              copilotFlow={oauth.copilotFlow}
              handlers={handlers}
            />
          </Col>
        ))}
      </Row>

      <ConfirmModal
        action={confirm}
        providers={providersApi.providers}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmed}
      />
    </Flex>
  );
}
