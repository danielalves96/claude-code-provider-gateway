import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Col, Flex, Row, Typography, theme } from "antd";

const { Text } = Typography;

interface HistorySummaryProps {
  sessionCount: number;
  archived: number;
  totalRequests: number;
  totalErrors: number;
}

export function HistorySummary({
  sessionCount,
  archived,
  totalRequests,
  totalErrors,
}: HistorySummaryProps) {
  const { token } = theme.useToken();

  const metrics = [
    {
      title: "Active Sessions",
      value: sessionCount,
      icon: <ClockCircleOutlined />,
      color: token.colorPrimary,
      active: sessionCount > 0,
    },
    {
      title: "Archived",
      value: archived,
      icon: <DatabaseOutlined />,
      color: token.colorTextSecondary,
      active: false,
    },
    {
      title: "Total Requests",
      value: totalRequests,
      icon: <CheckCircleOutlined />,
      color: token.colorSuccess,
      active: totalRequests > 0,
    },
    {
      title: "Total Errors",
      value: totalErrors,
      icon: <WarningOutlined />,
      color: token.colorError,
      active: totalErrors > 0,
    },
  ];

  return (
    <Row gutter={[token.paddingSM, token.paddingSM]}>
      {metrics.map((m) => (
        <Col xs={12} sm={12} lg={6} key={m.title} style={{ flex: 1 }}>
          <Card
            size="small"
            style={{
              borderColor: m.active ? `${m.color}40` : token.colorBorderSecondary,
              background: m.active
                ? `linear-gradient(145deg, ${token.colorBgContainer} 0%, ${m.color}15 100%)`
                : token.colorBgContainer,
              transition: "all 0.3s ease",
            }}
            styles={{ body: { padding: "8px 12px" } }}
          >
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={6}>
                <div
                  style={{
                    color: m.active ? m.color : token.colorTextTertiary,
                    fontSize: 14,
                    display: "flex",
                  }}
                >
                  {m.icon}
                </div>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  {m.title}
                </Text>
              </Flex>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: m.active ? m.color : token.colorTextPrimary,
                  fontFamily: "monospace",
                }}
              >
                {m.value.toLocaleString()}
              </Text>
            </Flex>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
