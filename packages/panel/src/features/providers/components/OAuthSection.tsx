import { Badge, Button, Flex, Space, Typography } from "antd";
import { DEVICE_FLOW_PROVIDERS } from "../constants.js";
import { getOAuthPresentation } from "../oauthPresentation.js";
import type { CopilotFlow, OAuthInfo, ProviderInfo } from "../types.js";
import { CopilotDevicePrompt } from "./CopilotDevicePrompt.js";

const { Text } = Typography;

interface OAuthSectionProps {
  provider: ProviderInfo;
  busy: boolean;
  error: string | null;
  copilotFlow: CopilotFlow | null;
  onLogin: () => void;
  onLogout: () => void;
  onCancelFlow: () => void;
}

export function OAuthSection({
  provider,
  busy,
  error,
  copilotFlow,
  onLogin,
  onLogout,
  onCancelFlow,
}: OAuthSectionProps) {
  const isDeviceFlow = DEVICE_FLOW_PROVIDERS.has(provider.id);
  const presentation = getOAuthPresentation(provider.id, provider.label);
  const oauth = provider.oauth;

  return (
    <Flex vertical gap={4}>
      <Text type="secondary">{presentation.accountLabel}</Text>

      {oauth?.loggedIn ? (
        <LoggedInRow oauth={oauth} onLogout={onLogout} />
      ) : isDeviceFlow && busy && copilotFlow ? (
        <CopilotDevicePrompt
          flow={copilotFlow}
          waitingText={presentation.waitingText}
          approvalSite={presentation.approvalSite}
          onCancel={onCancelFlow}
        />
      ) : (
        <LoginRow
          busy={busy}
          error={error}
          onLogin={onLogin}
          idleLabel={presentation.loginIdle}
          busyLabel={presentation.loginBusy}
        />
      )}
    </Flex>
  );
}

function LoggedInRow({ oauth, onLogout }: { oauth: OAuthInfo; onLogout: () => void }) {
  return (
    <Space>
      <Badge status="success" />
      <Text>{oauth.planType ? `ChatGPT ${oauth.planType}` : "Logged in"}</Text>
      {oauth.accountId && (
        <Text type="secondary" style={{ fontFamily: "monospace" }}>
          {oauth.accountId}
        </Text>
      )}
      <Button onClick={onLogout}>Logout</Button>
    </Space>
  );
}

interface LoginRowProps {
  busy: boolean;
  error: string | null;
  onLogin: () => void;
  idleLabel: string;
  busyLabel: string;
}

function LoginRow({ busy, error, onLogin, idleLabel, busyLabel }: LoginRowProps) {
  return (
    <Flex vertical gap={4}>
      <Button type="primary" loading={busy} onClick={onLogin}>
        {busy ? busyLabel : idleLabel}
      </Button>
      {error && <Text type="danger">{error}</Text>}
    </Flex>
  );
}
