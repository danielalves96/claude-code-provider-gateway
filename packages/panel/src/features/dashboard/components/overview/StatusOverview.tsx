import { Card, Col, Flex, Row, Skeleton, Typography, theme } from "antd";
import type { GatewayStatus } from "../../domain/types.js";
import { useStatusOverview } from "../../hooks/useStatusOverview.js";

const { Text } = Typography;

interface StatusOverviewProps {
  status: GatewayStatus | null;
  isLoading?: boolean;
}

export function StatusOverview({ status, isLoading }: StatusOverviewProps) {
  const { token } = theme.useToken();
  const cards = useStatusOverview(status);

  if (isLoading) {
    return (
      <Row gutter={[token.paddingSM, token.paddingSM]}>
        {(["sk-0", "sk-1", "sk-2", "sk-3"] as const).map((key) => (
          <Col xs={12} sm={12} lg={6} key={key} style={{ flex: 1 }}>
            <Card styles={{ body: { padding: `${token.paddingMD}px` } }}>
              <Flex align="center" gap={token.padding}>
                <Skeleton.Avatar active size={42} shape="circle" />
                <Flex vertical flex={1} gap={4}>
                  <Skeleton.Input active size="small" style={{ width: "60%" }} />
                  <Skeleton.Input active size="default" style={{ width: "40%" }} />
                </Flex>
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[token.paddingSM, token.paddingSM]}>
      {cards.map((c) => (
        <Col xs={12} sm={12} lg={6} key={c.title} style={{ flex: 1 }}>
          <Card
            styles={{ body: { padding: `${token.paddingMD}px` } }}
            style={{
              background: c.active
                ? `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${c.color}15 100%)`
                : token.colorBgContainer,
              borderColor: c.active ? `${c.color}30` : token.colorBorderSecondary,
            }}
          >
            <Flex align="center" gap={token.padding}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: c.active ? `${c.color}20` : token.colorFillQuaternary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  color: c.active ? c.color : token.colorTextTertiary,
                }}
              >
                {c.icon}
              </div>
              <Flex vertical flex={1}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  {c.title}
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 18,
                    color: c.active ? c.color : token.colorText,
                    fontFamily: "monospace",
                    marginTop: 2,
                  }}
                >
                  {c.value}
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
