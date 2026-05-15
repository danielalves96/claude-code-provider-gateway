import { Badge, Button, Card, Divider, Flex, Space, Switch, Tag, Typography, theme } from "antd";
import { LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "../constants.js";
import type { CopilotFlow, ProviderInfo, TestResult } from "../types.js";
import { ApiKeySection } from "./ApiKeySection.js";
import { BaseUrlSection } from "./BaseUrlSection.js";
import { ExtraModelsSection } from "./ExtraModelsSection.js";
import { ModelSelector } from "./ModelSelector.js";
import { OAuthSection } from "./OAuthSection.js";

const { Text } = Typography;

export interface ProviderCardHandlers {
  onTest: (id: string) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
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

interface ProviderCardProps {
  provider: ProviderInfo;
  testing: boolean;
  testResult?: TestResult;
  oauthBusyFor: string | null;
  oauthError: string | null;
  copilotFlow: CopilotFlow | null;
  handlers: ProviderCardHandlers;
}

export function ProviderCard({
  provider: p,
  testing,
  testResult,
  oauthBusyFor,
  oauthError,
  copilotFlow,
  handlers,
}: ProviderCardProps) {
  const { token } = theme.useToken();
  const isLocal = LOCAL_PROVIDERS.has(p.id);
  const isOAuth = OAUTH_PROVIDERS.has(p.id);
  const canTest = p.enabled && (isLocal || (isOAuth ? p.oauth?.loggedIn : p.hasKey));
  const ready = isLocal ? true : isOAuth ? p.oauth?.loggedIn === true : p.hasKey;

  return (
    <Card
      style={{ width: "100%", display: "flex", flexDirection: "column" }}
      styles={{
        body: {
          opacity: p.enabled ? 1 : 0.6,
          transition: "opacity 0.2s",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        },
      }}
      title={<CardTitle provider={p} result={testResult} />}
      extra={
        <Space>
          <Button loading={testing} disabled={!canTest} onClick={() => handlers.onTest(p.id)}>
            Test
          </Button>
          <Switch checked={p.enabled} onChange={() => handlers.onToggleEnabled(p.id, p.enabled)} />
        </Space>
      }
    >
      <Flex vertical gap={token.padding}>
        {isOAuth && (
          <>
            <OAuthSection
              providerId={p.id}
              oauth={p.oauth}
              busy={oauthBusyFor === p.id}
              error={oauthError}
              copilotFlow={copilotFlow}
              onLogin={() => handlers.onOAuthLogin(p.id)}
              onLogout={() => handlers.onOAuthLogout(p.id)}
              onCancelFlow={handlers.onCancelOAuthFlow}
            />
            {p.id !== "copilot" && (
              <ExtraModelsSection
                models={p.models ?? []}
                onAdd={(model) => handlers.onAddModel(p, model)}
                onRemove={(model) => handlers.onRemoveModel(p, model)}
              />
            )}
          </>
        )}

        {!isLocal && !isOAuth && (
          <ApiKeySection
            hasKey={p.hasKey}
            keyPreview={p.keyPreview}
            onSave={(value) => handlers.onSaveKey(p.id, value)}
            onRequestRemove={() => handlers.onRequestRemoveKey(p.id)}
            onRequestReplace={(value) => handlers.onRequestReplaceKey(p.id, value)}
          />
        )}

        {isLocal && (
          <BaseUrlSection
            baseUrl={p.baseUrl}
            onRequestChange={(url) => handlers.onRequestChangeUrl(p.id, url)}
          />
        )}

        {p.enabled && (
          <>
            <SingleProviderHint providerId={p.id} />
            <Divider style={{ margin: 0 }} />
            <ModelSelector
              providerId={p.id}
              disabledModels={p.disabledModels ?? []}
              ready={!!ready}
              onDisabledModelsChange={(disabled) => handlers.onDisabledModelsChange(p.id, disabled)}
            />
          </>
        )}
      </Flex>
    </Card>
  );
}

function CardTitle({ provider: p, result }: { provider: ProviderInfo; result?: TestResult }) {
  return (
    <Space>
      {p.enabled && <Badge status="processing" />}
      <Text strong>{p.label}</Text>
      {result && (
        <Tag color={result.ok ? "success" : "error"}>
          {result.ok
            ? `✓ ${result.modelCount ?? 0} models · ${result.latencyMs}ms`
            : `✗ ${result.error ?? "failed"}`}
        </Tag>
      )}
    </Space>
  );
}

function SingleProviderHint({ providerId }: { providerId: string }) {
  const { token } = theme.useToken();
  return (
    <Text style={{ fontFamily: "monospace", color: token.colorSuccessText }}>
      ccpg --{providerId.replace("_", "")}{" "}
      <Text type="secondary" style={{ fontFamily: "inherit" }}>
        — single-provider mode
      </Text>
    </Text>
  );
}
