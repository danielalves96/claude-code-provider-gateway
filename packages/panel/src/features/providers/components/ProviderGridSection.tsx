import { Col, Flex, Row, Typography, theme } from "antd";
import { COMING_SOON_PROVIDERS, LOCAL_PROVIDERS, OAUTH_PROVIDERS } from "../constants.js";
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

export function groupProvidersByConfiguration(providers: ProviderInfo[]): ProviderGroup[] {
  return [
    {
      title: "Local Providers",
      providers: sortProvidersByLabel(
        providers.filter((provider) => LOCAL_PROVIDERS.has(provider.id)),
      ),
    },
    {
      title: "OAuth Providers",
      providers: sortProvidersByLabel(
        providers.filter((provider) => OAUTH_PROVIDERS.has(provider.id)),
      ),
    },
    {
      title: "API Key Providers",
      providers: sortProvidersByLabel(providers.filter((provider) => isApiKeyProvider(provider))),
    },
  ].filter((group) => group.providers.length > 0);
}

function isApiKeyProvider(provider: ProviderInfo) {
  return !LOCAL_PROVIDERS.has(provider.id) && !OAUTH_PROVIDERS.has(provider.id);
}

function sortProvidersByLabel(providers: ProviderInfo[]) {
  return [...providers].sort(
    (a, b) =>
      Number(COMING_SOON_PROVIDERS.has(a.id)) - Number(COMING_SOON_PROVIDERS.has(b.id)) ||
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
}
