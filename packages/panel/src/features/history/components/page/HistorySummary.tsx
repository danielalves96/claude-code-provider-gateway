import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { theme } from "antd";
import { MetricSummaryGrid } from "../../../../shared/components/MetricSummaryGrid.js";

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
      id: "active-sessions",
      title: "Active Sessions",
      value: sessionCount,
      icon: <ClockCircleOutlined />,
      color: token.colorPrimary,
      active: sessionCount > 0,
    },
    {
      id: "archived",
      title: "Archived",
      value: archived,
      icon: <DatabaseOutlined />,
      color: token.colorTextSecondary,
      active: false,
    },
    {
      id: "total-requests",
      title: "Total Requests",
      value: totalRequests,
      icon: <CheckCircleOutlined />,
      color: token.colorSuccess,
      active: totalRequests > 0,
    },
    {
      id: "total-errors",
      title: "Total Errors",
      value: totalErrors,
      icon: <WarningOutlined />,
      color: token.colorError,
      active: totalErrors > 0,
    },
  ];

  return <MetricSummaryGrid items={metrics} />;
}
