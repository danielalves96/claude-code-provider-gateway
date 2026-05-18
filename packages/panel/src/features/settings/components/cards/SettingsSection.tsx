import { Col, Flex, Row, Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  isLast?: boolean;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  isLast,
}: SettingsSectionProps) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        padding: `${token.paddingXL}px 0`,
        borderBottom: isLast ? "none" : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Row gutter={[token.paddingXL, token.paddingXL]} align="top">
        {/* Left Column: Context */}
        <Col xs={24} lg={8} xl={7}>
          <Flex vertical gap={token.paddingXS}>
            <Flex align="center" gap={token.paddingSM}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: token.borderRadius,
                  background: `linear-gradient(135deg, ${token.colorFillContent} 0%, ${token.colorBgContainer} 100%)`,
                  color: token.colorPrimary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {icon}
              </div>
              <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
                {title}
              </Title>
            </Flex>
            <Text type="secondary" style={{ lineHeight: 1.6, paddingLeft: 32 + token.paddingSM }}>
              {description}
            </Text>
          </Flex>
        </Col>

        {/* Right Column: Controls */}
        <Col xs={24} lg={16} xl={17}>
          <div
            style={{
              background: token.colorFillQuaternary,
              borderRadius: token.borderRadiusLG,
              padding: token.paddingLG,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {children}
          </div>
        </Col>
      </Row>
    </div>
  );
}
