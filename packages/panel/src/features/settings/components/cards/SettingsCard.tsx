import { Card, Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

interface SettingsCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SettingsCard({ title, icon, children }: SettingsCardProps) {
  const { token } = theme.useToken();

  return (
    <Card
      style={{
        height: "100%",
        borderColor: token.colorBorderSecondary,
        background: token.colorBgContainer,
        boxShadow: token.boxShadow,
      }}
      styles={{
        header: {
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: `${token.padding}px ${token.paddingLG}px`,
        },
        body: {
          padding: token.paddingLG,
        },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <div
            style={{
              color: token.colorPrimary,
              fontSize: 18,
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
            {icon}
          </div>
          <Text strong style={{ fontSize: 16 }}>
            {title}
          </Text>
        </Flex>
      }
    >
      {children}
    </Card>
  );
}
