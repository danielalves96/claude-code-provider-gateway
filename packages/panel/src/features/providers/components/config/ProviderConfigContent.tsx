import { Divider, Flex } from "antd";
import { useEffect } from "react";
import { SUGGESTED_MODELS } from "../../data/suggestedModels.js";
import { getProviderKind, isProviderReady } from "../../domain/status.js";
import type { CopilotFlow, ProviderInfo } from "../../domain/types.js";
import { useProviderModels } from "../../hooks/useProviderModels.js";
import { ApiKeySection } from "./ApiKeySection.js";
import { BaseUrlSection } from "./BaseUrlSection.js";
import { ModelPickerSection } from "./ModelPickerSection.js";
import { ModelSelector } from "./ModelSelector.js";
import { OAuthProviderSettings } from "./OAuthProviderSettings.js";

export interface ProviderConfigHandlers {
  onSaveKey: (id: string, key: string) => void;
  onRequestReplaceKey: (id: string, key: string) => void;
  onRequestRemoveKey: (id: string) => void;
  onRequestChangeUrl: (id: string, url: string) => void;
  onAddModel: (p: ProviderInfo, model: string) => void;
  onRemoveModel: (p: ProviderInfo, model: string) => void;
  onDisabledModelsChange: (id: string, disabledModels: string[]) => void;
  onOAuthLogin: (id: string) => void;
  onOAuthLogout: (id: string) => void;
  onCancelOAuthFlow: () => void;
}

interface ProviderConfigContentProps {
  provider: ProviderInfo;
  oauthBusyFor: string | null;
  oauthError: string | null;
  copilotFlow: CopilotFlow | null;
  handlers: ProviderConfigHandlers;
}

export function ProviderConfigContent({
  provider,
  oauthBusyFor,
  oauthError,
  copilotFlow,
  handlers,
}: ProviderConfigContentProps) {
  const providerKind = getProviderKind(provider);
  const ready = isProviderReady(provider);
  const { models, loading, load } = useProviderModels(provider.id);

  // Eagerly discover models as soon as the provider is ready so we know
  // whether to show the model picker (discovery empty = picker needed).
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const discoveryDone = !loading && models !== null;
  const discoveredEmpty = discoveryDone && models.length === 0;

  // Show picker when: API key provider, ready, discovery returned nothing.
  // Also always show if already has manually configured models (so they're editable).
  const showPicker =
    providerKind === "api-key" &&
    ((discoveredEmpty && ready) || (provider.models ?? []).length > 0);

  return (
    <Flex vertical gap="large" style={{ marginTop: 24 }}>
      {providerKind === "oauth" && (
        <OAuthProviderSettings
          provider={provider}
          busy={oauthBusyFor === provider.id}
          error={oauthError}
          copilotFlow={copilotFlow}
          handlers={handlers}
        />
      )}

      {providerKind === "api-key" && (
        <ApiKeySection
          hasKey={provider.hasKey}
          keyPreview={provider.keyPreview}
          onSave={(value) => handlers.onSaveKey(provider.id, value)}
          onRequestRemove={() => handlers.onRequestRemoveKey(provider.id)}
          onRequestReplace={(value) => handlers.onRequestReplaceKey(provider.id, value)}
        />
      )}

      {showPicker && (
        <ModelPickerSection
          models={provider.models ?? []}
          suggestions={SUGGESTED_MODELS[provider.id as keyof typeof SUGGESTED_MODELS]}
          placeholder="provider/model-id"
          onAdd={(model) => handlers.onAddModel(provider, model)}
          onRemove={(model) => handlers.onRemoveModel(provider, model)}
        />
      )}

      {providerKind === "local" && (
        <BaseUrlSection
          baseUrl={provider.baseUrl}
          onRequestChange={(url) => handlers.onRequestChangeUrl(provider.id, url)}
        />
      )}

      {provider.enabled && (
        <>
          <Divider style={{ margin: 0 }} />
          <ModelSelector
            models={models}
            loading={loading}
            disabledModels={provider.disabledModels ?? []}
            ready={ready}
            onDisabledModelsChange={(disabled) =>
              handlers.onDisabledModelsChange(provider.id, disabled)
            }
          />
        </>
      )}
    </Flex>
  );
}
