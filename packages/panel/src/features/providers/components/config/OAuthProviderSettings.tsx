import type { CopilotFlow, ProviderInfo } from "../../domain/types.js";
import { ExtraModelsSection } from "./ExtraModelsSection.js";
import { OAuthSection } from "./OAuthSection.js";
import type { ProviderConfigHandlers } from "./ProviderConfigContent.js";

const EXTRA_MODELS_OAUTH_PROVIDERS = new Set(["openai_account", "kilocode", "cline"]);

interface OAuthProviderSettingsProps {
  provider: ProviderInfo;
  busy: boolean;
  error: string | null;
  copilotFlow: CopilotFlow | null;
  handlers: ProviderConfigHandlers;
}

export function OAuthProviderSettings({
  provider,
  busy,
  error,
  copilotFlow,
  handlers,
}: OAuthProviderSettingsProps) {
  const showExtraModels = EXTRA_MODELS_OAUTH_PROVIDERS.has(provider.id);

  return (
    <>
      <OAuthSection
        provider={provider}
        busy={busy}
        error={error}
        copilotFlow={copilotFlow}
        onLogin={() => handlers.onOAuthLogin(provider.id)}
        onLogout={() => handlers.onOAuthLogout(provider.id)}
        onCancelFlow={handlers.onCancelOAuthFlow}
      />
      {showExtraModels && (
        <ExtraModelsSection
          models={provider.models ?? []}
          placeholder={provider.id === "openai_account" ? "gpt-5.6-codex" : "provider/model-id"}
          onAdd={(model) => handlers.onAddModel(provider, model)}
          onRemove={(model) => handlers.onRemoveModel(provider, model)}
        />
      )}
    </>
  );
}
