import { FireOutlined, TrophyOutlined } from "@ant-design/icons";
import { Card, Col, Flex, Row, Tag, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";

const { Text } = Typography;

interface TopStat {
  name: string;
  id?: string;
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
        <TopStatCard
          title="Top Provider"
          icon={<TrophyOutlined />}
          color={token.colorPrimary}
          tagColor="blue"
          stat={topProvider}
          renderName={(stat) => <ProviderName stat={stat} />}
        />
      </Col>
      <Col xs={24} md={12}>
        <TopStatCard
          title="Most Used Model"
          icon={<FireOutlined />}
          color={token.colorWarning}
          tagColor="warning"
          stat={topModel}
          renderName={(stat) => (
            <Text
              strong
              style={{ fontSize: 18, fontFamily: "monospace", color: token.colorWarningText }}
            >
              {stat.name}
            </Text>
          )}
        />
      </Col>
    </Row>
  );
}

interface TopStatCardProps {
  title: string;
  icon: ReactNode;
  color: string;
  tagColor: string;
  stat: TopStat | null;
  renderName: (stat: TopStat) => ReactNode;
}

function TopStatCard({ title, icon, color, tagColor, stat, renderName }: TopStatCardProps) {
  const { token } = theme.useToken();

  return (
    <Card
      styles={{ body: { padding: `${token.paddingLG}px ${token.paddingXL}px` } }}
      style={{
        background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, ${color}15 100%)`,
        borderColor: `${color}30`,
      }}
    >
      <Flex align="center" gap={token.paddingLG}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `${color}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            color,
          }}
        >
          {icon}
        </div>
        <Flex vertical flex={1}>
          <Text
            type="secondary"
            style={{
              fontSize: token.fontSizeSM,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
          {stat ? (
            <Flex align="center" justify="space-between" style={{ marginTop: 4 }}>
              {renderName(stat)}
              <Tag color={tagColor} bordered={false} style={{ margin: 0 }}>
                {stat.requests} reqs
              </Tag>
            </Flex>
          ) : (
            <Text type="secondary">—</Text>
          )}
        </Flex>
      </Flex>
    </Card>
  );
}

function ProviderName({ stat }: { stat: TopStat }) {
  return (
    <Flex align="center" gap={8}>
      {stat.id && <ProviderLogo providerId={stat.id} label={stat.name} size={20} />}
      <Text strong style={{ fontSize: 18 }}>
        {stat.name}
      </Text>
    </Flex>
  );
}
