import { GithubOutlined } from "@ant-design/icons";
import { Badge, Button, Flex, Space, Typography } from "antd";
import { DEVICE_FLOW_PROVIDERS } from "../constants.js";
import type { CopilotFlow, OAuthInfo } from "../types.js";
import { CopilotDevicePrompt } from "./CopilotDevicePrompt.js";

const { Text } = Typography;

interface OAuthSectionProps {
  providerId: string;
  oauth: OAuthInfo | undefined;
  busy: boolean;
  error: string | null;
  copilotFlow: CopilotFlow | null;
  onLogin: () => void;
  onLogout: () => void;
  onCancelFlow: () => void;
}

export function OAuthSection({
  providerId,
  oauth,
  busy,
  error,
  copilotFlow,
  onLogin,
  onLogout,
  onCancelFlow,
}: OAuthSectionProps) {
  const isDeviceFlow = DEVICE_FLOW_PROVIDERS.has(providerId);
  const accountLabel = providerId === "copilot" ? "GitHub account" : "OpenAI account";

  return (
    <Flex vertical gap={4}>
      <Text type="secondary">
        <Space>
          <GithubOutlined />
          {accountLabel}
        </Space>
      </Text>

      {oauth?.loggedIn ? (
        <LoggedInRow oauth={oauth} onLogout={onLogout} />
      ) : isDeviceFlow && busy && copilotFlow ? (
        <CopilotDevicePrompt flow={copilotFlow} onCancel={onCancelFlow} />
      ) : (
        <LoginRow providerId={providerId} busy={busy} error={error} onLogin={onLogin} />
      )}
    </Flex>
  );
}

function LoggedInRow({ oauth, onLogout }: { oauth: OAuthInfo; onLogout: () => void }) {
  return (
    <Space>
      <Badge status="success" />
      <Text>{oauth.planType ? `ChatGPT ${oauth.planType}` : "Logged in"}</Text>
      <Text type="secondary" style={{ fontFamily: "monospace" }}>
        {oauth.accountId}
      </Text>
      <Button onClick={onLogout}>Logout</Button>
    </Space>
  );
}

interface LoginRowProps {
  providerId: string;
  busy: boolean;
  error: string | null;
  onLogin: () => void;
}

function LoginRow({ providerId, busy, error, onLogin }: LoginRowProps) {
  const isCopilot = providerId === "copilot";
  const buttonLabel = busy
    ? isCopilot
      ? "Starting GitHub login…"
      : "Waiting for browser…"
    : isCopilot
      ? "Login with GitHub"
      : "Login with OpenAI";

  return (
    <Flex vertical gap={4}>
      <Button type="primary" icon={<GithubOutlined />} loading={busy} onClick={onLogin}>
        {buttonLabel}
      </Button>
      {error && <Text type="danger">{error}</Text>}
    </Flex>
  );
}
