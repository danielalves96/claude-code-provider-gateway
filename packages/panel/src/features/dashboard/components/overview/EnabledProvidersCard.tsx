import { ThunderboltOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Flex, Row, Tag, Typography, theme } from "antd";
import { Link as RouterLink } from "react-router-dom";
import type { StatsResponse } from "../../domain/types.js";
import { ProviderStatCard } from "./ProviderStatCard.js";

const { Text } = Typography;

interface EnabledProvidersCardProps {
  stats: StatsResponse | null;
}

export function EnabledProvidersCard({ stats }: EnabledProvidersCardProps) {
  const { token } = theme.useToken();
  const count = stats?.providers.length ?? 0;

  return (
    <Card
      style={{
        borderColor: token.colorBorderSecondary,
        boxShadow: token.boxShadow,
      }}
      styles={{
        header: {
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: `${token.padding}px ${token.paddingLG}px`,
        },
        body: { padding: token.paddingLG },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <div
            style={{
              color: token.colorPrimary,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${token.colorPrimary}20 0%, ${token.colorBgContainer} 100%)`,
              border: `1px solid ${token.colorPrimary}30`,
              boxShadow: `0 0 10px ${token.colorPrimary}10`,
            }}
          >
            <ThunderboltOutlined />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            Current Session — Enabled Providers
          </Text>
          {stats && (
            <Tag
              color={count > 0 ? "processing" : "default"}
              style={{ border: "none", marginLeft: token.paddingSM, fontWeight: 500 }}
            >
              {count} ENABLED
            </Tag>
          )}
        </Flex>
      }
      extra={
        <Text type="secondary" style={{ fontSize: 13 }}>
          Stats reset on restart · <ThemedLink to="/history">History</ThemedLink>
        </Text>
      }
    >
      {count === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              No providers enabled. <ThemedLink to="/providers">Configure providers</ThemedLink>
            </Text>
          }
        />
      ) : (
        <Row gutter={[token.paddingLG, token.paddingLG]}>
          {stats?.providers.map((p) => (
            <Col xs={24} sm={12} xl={8} key={p.id}>
              <ProviderStatCard provider={p} />
            </Col>
          ))}
        </Row>
      )}
    </Card>
  );
}

function ThemedLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <RouterLink to={to} style={{ color: token.colorPrimary, fontWeight: 500 }}>
      {children}
    </RouterLink>
  );
}
