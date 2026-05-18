import type { CopilotFlow, ProviderInfo } from "../types.js";
import { ExtraModelsSection } from "./ExtraModelsSection.js";
import { OAuthSection } from "./OAuthSection.js";
import type { ProviderConfigHandlers } from "./ProviderConfigContent.js";

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
      {provider.id === "openai_account" && (
        <ExtraModelsSection
          models={provider.models ?? []}
          placeholder="gpt-5.6-codex"
          onAdd={(model) => handlers.onAddModel(provider, model)}
          onRemove={(model) => handlers.onRemoveModel(provider, model)}
        />
      )}
    </>
  );
}
