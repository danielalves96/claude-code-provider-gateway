import { Card, Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

export interface MetricSummaryItem {
  id: string;
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  active: boolean;
}

interface MetricSummaryGridProps {
  items: MetricSummaryItem[];
  minWidth?: number;
}

export function MetricSummaryGrid({ items, minWidth = 150 }: MetricSummaryGridProps) {
  const { token } = theme.useToken();

  return (
    <Flex gap={token.paddingSM} wrap="wrap">
      {items.map((item) => (
        <div key={item.id} style={{ flex: `1 1 ${minWidth}px`, minWidth: 0 }}>
          <MetricSummaryCard item={item} />
        </div>
      ))}
    </Flex>
  );
}

function MetricSummaryCard({ item }: { item: MetricSummaryItem }) {
  const { token } = theme.useToken();

  return (
    <Card
      size="small"
      style={{
        borderColor: item.active ? `${item.color}40` : token.colorBorderSecondary,
        background: item.active
          ? `linear-gradient(145deg, ${token.colorBgContainer} 0%, ${item.color}15 100%)`
          : token.colorBgContainer,
        transition: "all 0.3s ease",
      }}
      styles={{ body: { padding: "8px 12px" } }}
    >
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={6}>
          <div
            style={{
              color: item.active ? item.color : token.colorTextTertiary,
              fontSize: 14,
              display: "flex",
            }}
          >
            {item.icon}
          </div>
          <Text
            type="secondary"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {item.title}
          </Text>
        </Flex>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: item.active ? item.color : token.colorText,
            fontFamily: "monospace",
          }}
        >
          {item.value.toLocaleString()}
        </Text>
      </Flex>
    </Card>
  );
}
