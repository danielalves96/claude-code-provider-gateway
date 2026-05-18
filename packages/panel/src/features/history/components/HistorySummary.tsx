import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Space, Statistic, theme } from "antd";

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
    <Row gutter={[token.paddingLG, token.paddingLG]}>
      {metrics.map((m) => (
        <Col xs={12} xl={6} key={m.title}>
          <Card
            styles={{
              body: { padding: token.paddingLG },
            }}
            style={{
              borderColor: m.active ? `${m.color}40` : token.colorBorderSecondary,
              boxShadow: m.active ? `0 0 12px 1px ${m.color}15` : undefined,
              transition: "all 0.3s ease",
            }}
          >
            <Statistic
              title={
                <Space>
                  <span style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                  <span style={{ color: token.colorTextSecondary }}>{m.title}</span>
                </Space>
              }
              value={m.value}
              valueStyle={{
                color: m.title === "Total Errors" && m.active ? token.colorError : token.colorText,
                fontWeight: 600,
                fontSize: 28,
              }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
