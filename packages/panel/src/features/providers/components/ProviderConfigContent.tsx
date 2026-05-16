import { Divider, Flex } from "antd";
import { LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "../constants.js";
import type { CopilotFlow, ProviderInfo } from "../types.js";
import { ApiKeySection } from "./ApiKeySection.js";
import { BaseUrlSection } from "./BaseUrlSection.js";
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
            providerId={provider.id}
            disabledModels={provider.disabledModels ?? []}
            ready={isProviderReady(provider)}
            onDisabledModelsChange={(disabled) =>
              handlers.onDisabledModelsChange(provider.id, disabled)
            }
          />
        </>
      )}
    </Flex>
  );
}

function getProviderKind(provider: ProviderInfo) {
  if (LOCAL_PROVIDERS.has(provider.id)) return "local";
  if (OAUTH_PROVIDERS.has(provider.id)) return "oauth";
  return "api-key";
}

function isProviderReady(provider: ProviderInfo) {
  if (LOCAL_PROVIDERS.has(provider.id)) return true;
  if (OAUTH_PROVIDERS.has(provider.id)) return provider.oauth?.loggedIn === true;
  return provider.hasKey;
}
