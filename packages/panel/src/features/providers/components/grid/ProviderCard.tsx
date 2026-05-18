import { StarFilled, StarOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Space, Switch, Tag, Tooltip, Typography, theme } from "antd";
import { COMING_SOON_PROVIDERS } from "../../domain/constants.js";
import { isProviderReady } from "../../domain/status.js";
import type { ProviderInfo, TestResult } from "../../domain/types.js";
import { ProviderLogo } from "./ProviderLogo.js";

const { Text } = Typography;

type ProviderStatus = {
  badge: "default" | "success" | "warning" | "processing";
  label: string;
  ready: boolean;
};

interface ProviderCardProps {
  provider: ProviderInfo;
  testResult?: TestResult;
  onClick: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (provider: ProviderInfo, event: React.MouseEvent) => void;
}

export function ProviderCard({
  provider: p,
  testResult,
  onClick,
  onToggleEnabled,
  isFavorite,
  onToggleFavorite,
}: ProviderCardProps) {
  const { token } = theme.useToken();
  const comingSoon = COMING_SOON_PROVIDERS.has(p.id);
  const status = getProviderStatus(p, comingSoon);
  const interactive = !comingSoon;

  return (
    <Card
      hoverable={interactive}
      onClick={interactive ? () => onClick(p) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick(p);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? `Configure ${p.label}` : `${p.label} — coming soon`}
      aria-disabled={!interactive}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderColor: p.enabled && !status.ready ? token.colorWarningBorder : undefined,
        cursor: interactive ? "pointer" : "not-allowed",
        opacity: comingSoon ? 0.65 : 1,
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
              opacity: p.enabled || comingSoon ? 1 : 0.6,
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
              {!comingSoon && testResult && (
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
        {comingSoon ? (
          <Tooltip title="OAuth flow not yet implemented">
            <Switch checked={false} disabled size="small" aria-label={`${p.label} — coming soon`} />
          </Tooltip>
        ) : (
          <Space size={8}>
            {onToggleFavorite && (
              <Button
                type="text"
                size="small"
                icon={
                  isFavorite ? (
                    <StarFilled style={{ color: token.colorWarning }} />
                  ) : (
                    <StarOutlined style={{ color: token.colorTextQuaternary }} />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(p, e);
                }}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              />
            )}
            <Switch
              checked={p.enabled}
              onClick={(_, event) => event.stopPropagation()}
              onChange={() => onToggleEnabled(p.id, p.enabled)}
              size="small"
              aria-label={`${p.enabled ? "Disable" : "Enable"} ${p.label}`}
            />
          </Space>
        )}
      </div>
    </Card>
  );
}

function getProviderStatus(provider: ProviderInfo, comingSoon: boolean): ProviderStatus {
  const ready = isProviderReady(provider);

  if (comingSoon) {
    return { badge: "processing", label: "Coming soon", ready: false };
  }

  if (!provider.enabled) {
    return { badge: "default", label: "Disabled", ready };
  }

  return ready
    ? { badge: "success", label: "Ready", ready }
    : { badge: "warning", label: "Needs Config", ready };
}
