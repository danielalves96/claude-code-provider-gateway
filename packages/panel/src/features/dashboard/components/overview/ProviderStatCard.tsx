import { Card, Flex, Typography, theme } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ProviderStat } from "../../domain/types.js";
import { useProviderStatCard } from "../../hooks/useProviderStatCard.js";

const { Text } = Typography;

interface ProviderStatCardProps {
  provider: ProviderStat;
}

export function ProviderStatCard({ provider: p }: ProviderStatCardProps) {
  const { token } = theme.useToken();
  const view = useProviderStatCard(p);

  return (
    <Card
      size="small"
      style={{
        background: p.requests > 0 ? token.colorFillAlter : token.colorFillQuaternary,
        borderColor: token.colorBorder,
        opacity: p.requests > 0 ? 1 : 0.78,
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
          <ProviderLogo providerId={p.id} label={p.label} size={20} />
          <Text strong>{p.label}</Text>
          {p.requests === 0 && (
            <Text type="secondary" style={{ marginLeft: "auto", fontSize: 12 }}>
              NO HISTORY
            </Text>
          )}
          {view.hasErrors && (
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
              {view.errorRate}% ERRORS
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
            {view.averageLatency}
          </Text>
        </Flex>
      </Flex>

      <Flex gap={token.paddingXS} style={{ marginTop: token.padding }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Last active: {view.lastActivity}
        </Text>
      </Flex>
    </Card>
  );
}
