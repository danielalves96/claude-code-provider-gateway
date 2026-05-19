import { Col, Flex, Row, Typography, theme } from "antd";
import type { ProviderInfo, TestResult } from "../../domain/types.js";
import { ProviderCard } from "./ProviderCard.js";

const { Title } = Typography;

interface ProviderGridSectionProps {
  title: string;
  providers: ProviderInfo[];
  testResults: Record<string, TestResult>;
  onProviderSelect: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
  favorites?: string[];
  onToggleFavorite?: (provider: ProviderInfo, event: React.MouseEvent) => void;
}

export function ProviderGridSection({
  title,
  providers,
  testResults,
  onProviderSelect,
  onToggleEnabled,
  favorites = [],
  onToggleFavorite,
}: ProviderGridSectionProps) {
  const { token } = theme.useToken();

  if (providers.length === 0) return null;

  return (
    <Flex vertical gap={token.paddingSM}>
      <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
        {title}
      </Title>
      <Row gutter={[token.paddingMD, token.paddingMD]} align="stretch">
        {providers.map((provider) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={provider.id}>
            <ProviderCard
              provider={provider}
              testResult={testResults[provider.id]}
              onClick={onProviderSelect}
              onToggleEnabled={onToggleEnabled}
              isFavorite={favorites.includes(provider.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}
