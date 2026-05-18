import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CodeOutlined,
  DesktopOutlined,
} from "@ant-design/icons";
import { theme } from "antd";
import type { ReactNode } from "react";
import { formatUptime } from "../../../shared/utils/time.js";
import type { GatewayStatus } from "../domain/types.js";

export interface StatusOverviewCard {
  title: string;
  value: string;
  icon: ReactNode;
  color: string;
  active: boolean;
}

export function useStatusOverview(status: GatewayStatus | null): StatusOverviewCard[] {
  const { token } = theme.useToken();

  return [
    {
      title: "Status",
      value: getStatusLabel(status),
      icon: getStatusIcon(status),
      color: getStatusColor(status, token),
      active: !!status?.running,
    },
    {
      title: "Uptime",
      value: status ? formatUptime(status.uptimeMs) : "—",
      icon: <ClockCircleOutlined />,
      color: token.colorPrimary,
      active: !!status,
    },
    {
      title: "Model Mode",
      value: status?.modelMode ?? "—",
      icon: <CodeOutlined />,
      color: token.colorInfo,
      active: !!status,
    },
    {
      title: "Daemon PID",
      value: status?.pid?.toString() ?? "—",
      icon: <DesktopOutlined />,
      color: token.colorWarning,
      active: !!status,
    },
  ];
}

function getStatusLabel(status: GatewayStatus | null): string {
  if (!status) return "—";
  return status.running ? "Running" : "Stopped";
}

function getStatusIcon(status: GatewayStatus | null): ReactNode {
  if (!status || status.running) return <CheckCircleFilled />;
  return <CloseCircleFilled />;
}

function getStatusColor(
  status: GatewayStatus | null,
  token: ReturnType<typeof theme.useToken>["token"],
): string {
  if (!status) return token.colorTextTertiary;
  return status.running ? token.colorSuccess : token.colorError;
}
