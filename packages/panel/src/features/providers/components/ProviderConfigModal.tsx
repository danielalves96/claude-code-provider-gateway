import { Button, Modal, Switch } from "antd";
import { canTestProvider } from "../status.js";
import type { CopilotFlow, ProviderInfo } from "../types.js";
import { ProviderConfigContent, type ProviderConfigHandlers } from "./ProviderConfigContent.js";
import { ProviderLogo } from "./ProviderLogo.js";

export interface ProviderConfigModalHandlers extends ProviderConfigHandlers {
  onTest: (id: string) => void;
}

export interface ProviderConfigModalProps {
  provider: ProviderInfo | null;
  open: boolean;
  onClose: () => void;
  testing: boolean;
  oauthBusyFor: string | null;
  oauthError: string | null;
  copilotFlow: CopilotFlow | null;
  handlers: ProviderConfigModalHandlers;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
}

export function ProviderConfigModal({
  provider: p,
  open,
  onClose,
  testing,
  oauthBusyFor,
  oauthError,
  copilotFlow,
  handlers,
  onToggleEnabled,
}: ProviderConfigModalProps) {
  if (!p) return null;

  return (
    <Modal
      title={<ProviderConfigTitle provider={p} onToggleEnabled={onToggleEnabled} />}
      open={open}
      onCancel={onClose}
      footer={[
        <Button
          key="test"
          loading={testing}
          disabled={!canTestProvider(p)}
          onClick={() => handlers.onTest(p.id)}
        >
          Test Connection
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Done
        </Button>,
      ]}
      width={600}
      destroyOnClose
    >
      <ProviderConfigContent
        provider={p}
        oauthBusyFor={oauthBusyFor}
        oauthError={oauthError}
        copilotFlow={copilotFlow}
        handlers={handlers}
      />
    </Modal>
  );
}

function ProviderConfigTitle({
  provider,
  onToggleEnabled,
}: {
  provider: ProviderInfo;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingRight: 32,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ProviderLogo providerId={provider.id} label={provider.label} size={28} />
        <span style={{ fontSize: 18 }}>{provider.label} Configuration</span>
      </div>
      <Switch
        size="small"
        checked={provider.enabled}
        onChange={() => onToggleEnabled(provider.id, provider.enabled)}
        aria-label={`${provider.enabled ? "Disable" : "Enable"} ${provider.label}`}
      />
    </div>
  );
}
