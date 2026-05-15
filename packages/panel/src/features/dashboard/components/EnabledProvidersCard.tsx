import { ThunderboltOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Row, Space, Tag, Typography, theme } from "antd";
import { Link as RouterLink } from "react-router-dom";
import type { StatsResponse } from "../types.js";
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
      title={
        <Space>
          <ThunderboltOutlined style={{ color: token.colorPrimary }} />
          <span>Current Session — Enabled Providers</span>
          {stats && <Tag color={count > 0 ? "processing" : "default"}>{count} enabled</Tag>}
        </Space>
      }
      extra={
        <Text type="secondary">
          Stats reset on daemon restart · <ThemedLink to="/history">History</ThemedLink>
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
        <Row gutter={[token.padding, token.padding]}>
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
    <RouterLink to={to} style={{ color: token.colorPrimary }}>
      {children}
    </RouterLink>
  );
}
