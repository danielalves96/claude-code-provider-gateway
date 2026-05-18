import { TrophyOutlined, FireOutlined } from "@ant-design/icons";
import { Card, Col, Flex, Row, Typography, theme, Tag } from "antd";
import { ProviderLogo } from "../../providers/components/ProviderLogo.js";
import { providerLabel } from "../labels.js";

const { Text } = Typography;

interface TopStat {
  name: string;
  id?: string; // used for provider logo
  requests: number;
}

interface HistoryTopStatsProps {
  topProvider: TopStat | null;
  topModel: TopStat | null;
}

export function HistoryTopStats({ topProvider, topModel }: HistoryTopStatsProps) {
  const { token } = theme.useToken();

  if (!topProvider && !topModel) return null;

  return (
    <Row gutter={[token.paddingLG, token.paddingLG]}>
      <Col xs={24} md={12}>
        <Card
          styles={{ body: { padding: `${token.paddingLG}px ${token.paddingXL}px` } }}
          style={{
            background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorPrimary}15 100%)`,
            borderColor: `${token.colorPrimary}30`,
          }}
        >
          <Flex align="center" gap={token.paddingLG}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `${token.colorPrimary}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: token.colorPrimary,
              }}
            >
              <TrophyOutlined />
            </div>
            <Flex vertical flex={1}>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Top Provider
              </Text>
              {topProvider ? (
                <Flex align="center" justify="space-between" style={{ marginTop: 4 }}>
                  <Flex align="center" gap={8}>
                    {topProvider.id && <ProviderLogo providerId={topProvider.id} label={topProvider.name} size={20} />}
                    <Text strong style={{ fontSize: 18 }}>
                      {topProvider.name}
                    </Text>
                  </Flex>
                  <Tag color="blue" bordered={false} style={{ margin: 0 }}>
                    {topProvider.requests} reqs
                  </Tag>
                </Flex>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Flex>
          </Flex>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card
          styles={{ body: { padding: `${token.paddingLG}px ${token.paddingXL}px` } }}
          style={{
            background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${token.colorWarning}15 100%)`,
            borderColor: `${token.colorWarning}30`,
          }}
        >
          <Flex align="center" gap={token.paddingLG}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `${token.colorWarning}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: token.colorWarning,
              }}
            >
              <FireOutlined />
            </div>
            <Flex vertical flex={1}>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Most Used Model
              </Text>
              {topModel ? (
                <Flex align="center" justify="space-between" style={{ marginTop: 4 }}>
                  <Text strong style={{ fontSize: 18, fontFamily: "monospace", color: token.colorWarningText }}>
                    {topModel.name}
                  </Text>
                  <Tag color="warning" bordered={false} style={{ margin: 0 }}>
                    {topModel.requests} reqs
                  </Tag>
                </Flex>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Flex>
          </Flex>
        </Card>
      </Col>
    </Row>
  );
}
