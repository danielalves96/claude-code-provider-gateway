import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Card, Col, Row, Statistic, theme } from "antd";
import { formatUptime } from "../../../shared/utils/time.js";
import type { GatewayStatus } from "../types.js";

interface StatusOverviewProps {
  status: GatewayStatus | null;
}

export function StatusOverview({ status }: StatusOverviewProps) {
  const { token } = theme.useToken();

  const statusValue = status?.running ? "Running" : status ? "Stopped" : "—";
  const statusColor = status?.running ? token.colorSuccess : status ? token.colorError : undefined;
  const statusIcon = status?.running ? (
    <CheckCircleFilled />
  ) : status ? (
    <CloseCircleFilled />
  ) : undefined;

  return (
    <Row gutter={[token.padding, token.padding]}>
      <Col span={6}>
        <Card>
          <Statistic
            title="Status"
            value={statusValue}
            valueStyle={{ color: statusColor }}
            prefix={statusIcon}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="Uptime" value={status ? formatUptime(status.uptimeMs) : "—"} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="Model Mode" value={status?.modelMode ?? "—"} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic title="PID" value={status?.pid?.toString() ?? "—"} groupSeparator="" />
        </Card>
      </Col>
    </Row>
  );
}
