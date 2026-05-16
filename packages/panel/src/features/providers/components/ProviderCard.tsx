import { Badge, Card, Space, Switch, Tag, Typography, theme } from "antd";
import { LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "../constants.js";
import type { ProviderInfo, TestResult } from "../types.js";
import { ProviderLogo } from "./ProviderLogo.js";

const { Text } = Typography;

type ProviderStatus = {
  badge: "default" | "success" | "warning";
  label: string;
  ready: boolean;
};

interface ProviderCardProps {
  provider: ProviderInfo;
  testResult?: TestResult;
  onClick: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
}

export function ProviderCard({
  provider: p,
  testResult,
  onClick,
  onToggleEnabled,
}: ProviderCardProps) {
  const { token } = theme.useToken();
  const status = getProviderStatus(p);

  return (
    <Card
      hoverable
      onClick={() => onClick(p)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(p);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Configure ${p.label}`}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderColor: p.enabled && !status.ready ? token.colorWarningBorder : undefined,
      }}
      styles={{
        body: {
          padding: token.padding,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        },
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <ProviderLogo providerId={p.id} label={p.label} size={42} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              opacity: p.enabled ? 1 : 0.6,
              transition: "opacity 0.2s",
            }}
          >
            <Text strong ellipsis style={{ fontSize: 15, lineHeight: 1.2 }}>
              {p.label}
            </Text>

            <Space size={6} wrap style={{ marginTop: 4 }}>
              <Badge
                status={status.badge}
                text={<span style={{ fontSize: 12 }}>{status.label}</span>}
              />
              {testResult && (
                <Tag
                  color={testResult.ok ? "success" : "error"}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {testResult.ok ? `${testResult.latencyMs}ms` : "Error"}
                </Tag>
              )}
            </Space>
          </div>
        </div>
        <Switch
          checked={p.enabled}
          onClick={(_, event) => event.stopPropagation()}
          onChange={() => onToggleEnabled(p.id, p.enabled)}
          size="small"
          aria-label={`${p.enabled ? "Disable" : "Enable"} ${p.label}`}
        />
      </div>
    </Card>
  );
}

function getProviderStatus(provider: ProviderInfo): ProviderStatus {
  const ready = isProviderReady(provider);

  if (!provider.enabled) {
    return { badge: "default", label: "Disabled", ready };
  }

  return ready
    ? { badge: "success", label: "Ready", ready }
    : { badge: "warning", label: "Needs Config", ready };
}

function isProviderReady(provider: ProviderInfo) {
  if (LOCAL_PROVIDERS.has(provider.id)) return true;
  if (OAUTH_PROVIDERS.has(provider.id)) return provider.oauth?.loggedIn === true;
  return provider.hasKey;
}
