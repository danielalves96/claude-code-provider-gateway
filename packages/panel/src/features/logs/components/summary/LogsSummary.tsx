import {
  BugOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ProfileOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { theme } from "antd";
import { MetricSummaryGrid } from "../../../../shared/components/MetricSummaryGrid.js";

interface LogsSummaryProps {
  totalLines: number;
  errors: number;
  warns: number;
  infos: number;
  debugs: number;
}

export function LogsSummary({ totalLines, errors, warns, infos, debugs }: LogsSummaryProps) {
  const { token } = theme.useToken();

  const cards = [
    {
      id: "total-lines",
      title: "Total Lines",
      value: totalLines,
      icon: <ProfileOutlined />,
      color: token.colorPrimary,
      active: true,
    },
    {
      id: "errors",
      title: "Errors",
      value: errors,
      icon: <CloseCircleOutlined />,
      color: token.colorError,
      active: errors > 0,
    },
    {
      id: "warnings",
      title: "Warnings",
      value: warns,
      icon: <WarningOutlined />,
      color: token.colorWarning,
      active: warns > 0,
    },
    {
      id: "info",
      title: "Info",
      value: infos,
      icon: <InfoCircleOutlined />,
      color: token.colorSuccess,
      active: infos > 0,
    },
    {
      id: "debug",
      title: "Debug",
      value: debugs,
      icon: <BugOutlined />,
      color: token.colorTextSecondary,
      active: debugs > 0,
    },
  ];

  return <MetricSummaryGrid items={cards} />;
}
