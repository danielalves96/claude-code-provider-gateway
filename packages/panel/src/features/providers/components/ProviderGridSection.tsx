import { Col, Flex, Row, Typography, theme } from "antd";
import { LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "../constants.js";
import type { ProviderInfo, TestResult } from "../types.js";
import { ProviderCard } from "./ProviderCard.js";

const { Title } = Typography;

export type ProviderGroup = {
  title: string;
  providers: ProviderInfo[];
};

interface ProviderGridSectionProps {
  title: string;
  providers: ProviderInfo[];
  testResults: Record<string, TestResult>;
  onProviderSelect: (provider: ProviderInfo) => void;
  onToggleEnabled: (id: string, currentlyEnabled: boolean) => void;
}

export function ProviderGridSection({
  title,
  providers,
  testResults,
  onProviderSelect,
  onToggleEnabled,
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
            />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}

export function groupProvidersByConfiguration(providers: ProviderInfo[]): ProviderGroup[] {
  return [
    {
      title: "Local Providers",
      providers: providers.filter((provider) => LOCAL_PROVIDERS.has(provider.id)),
    },
    {
      title: "OAuth Providers",
      providers: providers.filter((provider) => OAUTH_PROVIDERS.has(provider.id)),
    },
    {
      title: "API Key Providers",
      providers: providers.filter((provider) => isApiKeyProvider(provider)),
    },
  ].filter((group) => group.providers.length > 0);
}

function isApiKeyProvider(provider: ProviderInfo) {
  return !LOCAL_PROVIDERS.has(provider.id) && !OAUTH_PROVIDERS.has(provider.id);
}
