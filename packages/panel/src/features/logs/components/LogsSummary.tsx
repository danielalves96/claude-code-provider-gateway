import {
  BugOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ProfileOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Flex, Typography, theme } from "antd";

const { Text } = Typography;

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
      title: "Total Lines",
      value: totalLines,
      icon: <ProfileOutlined />,
      color: token.colorPrimary,
      active: true,
    },
    {
      title: "Errors",
      value: errors,
      icon: <CloseCircleOutlined />,
      color: token.colorError,
      active: errors > 0,
    },
    {
      title: "Warnings",
      value: warns,
      icon: <WarningOutlined />,
      color: token.colorWarning,
      active: warns > 0,
    },
    {
      title: "Info",
      value: infos,
      icon: <InfoCircleOutlined />,
      color: token.colorSuccess,
      active: infos > 0,
    },
    {
      title: "Debug",
      value: debugs,
      icon: <BugOutlined />,
      color: token.colorTextSecondary,
      active: debugs > 0,
    },
  ];

  return (
    <Flex gap={token.paddingSM} wrap="wrap">
      {cards.map((c) => (
        <div key={c.title} style={{ flex: "1 1 150px", minWidth: 0 }}>
          <Card
            size="small"
            style={{
              borderColor: c.active ? `${c.color}40` : token.colorBorderSecondary,
              background: c.active
                ? `linear-gradient(145deg, ${token.colorBgContainer} 0%, ${c.color}15 100%)`
                : token.colorBgContainer,
              transition: "all 0.3s ease",
            }}
            styles={{ body: { padding: "8px 12px" } }}
          >
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={6}>
                <div
                  style={{
                    color: c.active ? c.color : token.colorTextTertiary,
                    fontSize: 14,
                    display: "flex",
                  }}
                >
                  {c.icon}
                </div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {c.title}
                </Text>
              </Flex>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: c.active ? c.color : token.colorTextPrimary,
                  fontFamily: "monospace",
                }}
              >
                {c.value.toLocaleString()}
              </Text>
            </Flex>
          </Card>
        </div>
      ))}
    </Flex>
  );
}
