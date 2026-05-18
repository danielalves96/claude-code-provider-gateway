import { Card, Flex, Typography, theme } from "antd";
import { formatRelative } from "../../../shared/utils/time.js";
import { ProviderLogo } from "../../providers/components/ProviderLogo.js";
import type { ProviderStat } from "../types.js";

const { Text } = Typography;

interface ProviderStatCardProps {
  provider: ProviderStat;
}

export function ProviderStatCard({ provider: p }: ProviderStatCardProps) {
  const { token } = theme.useToken();
  const errorRate = p.requests > 0 ? Math.round((p.errors / p.requests) * 100) : 0;
  const lastActivity = p.lastActivityAt ? formatRelative(p.lastActivityAt) : "never";

  // Note: p.id corresponds to the provider ID which is needed for the logo.
  const providerId = p.id;

  return (
    <Card
      size="small"
      style={{
        background: token.colorFillAlter,
        borderColor: token.colorBorder,
      }}
      styles={{
        header: {
          padding: `${token.paddingSM}px ${token.padding}px`,
          borderBottom: `1px solid ${token.colorBorder}`,
        },
        body: { padding: token.padding },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <ProviderLogo providerId={providerId} label={p.label} size={20} />
          <Text strong>{p.label}</Text>
          {p.errors > 0 && (
            <div
              style={{
                marginLeft: "auto",
                background: `${token.colorError}15`,
                color: token.colorError,
                padding: "2px 8px",
                borderRadius: token.borderRadiusSM,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {errorRate}% ERRORS
            </div>
          )}
        </Flex>
      }
    >
      <Flex gap={token.paddingLG}>
        <Flex vertical>
          <Text
            type="secondary"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Requests
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 600, fontFamily: "monospace" }}>
            {p.requests}
          </Text>
        </Flex>
        <Flex vertical>
          <Text
            type="secondary"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            Avg Latency
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 600, fontFamily: "monospace" }}>
            {p.requests > 0 ? `${p.avgLatencyMs}ms` : "—"}
          </Text>
        </Flex>
      </Flex>

      <Flex gap={token.paddingXS} style={{ marginTop: token.padding }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Last active: {lastActivity}
        </Text>
        {p.lastError && (
          <Text type="danger" style={{ fontSize: 12, marginLeft: "auto" }}>
            {p.lastError.length > 30 ? `${p.lastError.slice(0, 30)}…` : p.lastError}
          </Text>
        )}
      </Flex>
    </Card>
  );
}
