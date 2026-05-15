import { Card, Col, Flex, Row, Statistic, Tag, Tooltip, Typography, theme } from "antd";
import { formatRelative } from "../../../shared/utils/time.js";
import type { ProviderStat } from "../types.js";

const { Text } = Typography;

interface ProviderStatCardProps {
  provider: ProviderStat;
}

export function ProviderStatCard({ provider: p }: ProviderStatCardProps) {
  const { token } = theme.useToken();
  const errorRate = p.requests > 0 ? Math.round((p.errors / p.requests) * 100) : 0;
  const lastActivity = p.lastActivityAt ? formatRelative(p.lastActivityAt) : "never";

  return (
    <Card
      title={p.label}
      extra={
        p.errors > 0 ? (
          <Tooltip title={p.lastError ?? ""}>
            <Tag color="error">{errorRate}% errors</Tag>
          </Tooltip>
        ) : undefined
      }
    >
      <Row gutter={token.padding}>
        <Col span={12}>
          <Statistic title="Requests" value={p.requests} />
        </Col>
        <Col span={12}>
          <Statistic title="Avg latency" value={p.requests > 0 ? `${p.avgLatencyMs}ms` : "—"} />
        </Col>
      </Row>
      <Flex gap={token.paddingXS} style={{ marginTop: token.paddingSM }}>
        <Text type="secondary">Last: {lastActivity}</Text>
        {p.lastError && (
          <Tooltip title={p.lastError}>
            <Text type="danger">· {p.lastError.slice(0, 40)}…</Text>
          </Tooltip>
        )}
      </Flex>
    </Card>
  );
}
