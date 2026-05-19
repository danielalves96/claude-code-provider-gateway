import { Card, Col, Flex, Row, Skeleton, Typography, theme } from "antd";

const { Title } = Typography;

function ProviderCardSkeleton() {
  const { token } = theme.useToken();

  return (
    <Card style={{ width: "100%", height: "100%" }} styles={{ body: { padding: token.padding } }}>
      <Flex align="center" justify="space-between" gap={12}>
        <Flex align="center" gap={12} style={{ flex: 1, minWidth: 0 }}>
          <Skeleton.Avatar
            active
            size={42}
            shape="square"
            style={{ borderRadius: 8, flexShrink: 0 }}
          />
          <Flex vertical gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Skeleton.Input active size="small" style={{ width: "55%", minWidth: 80 }} />
            <Skeleton.Input active size="small" style={{ width: "35%", minWidth: 60 }} />
          </Flex>
        </Flex>
        <Skeleton.Button active size="small" shape="round" style={{ width: 32 }} />
      </Flex>
    </Card>
  );
}

function ProviderGroupSkeleton({ title, count }: { title: string; count: number }) {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={token.paddingSM}>
      <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
        {title}
      </Title>
      <Row gutter={[token.paddingMD, token.paddingMD]} align="stretch">
        {Array.from({ length: count }, (_, i) => `sk-${i}` as const).map((key) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={key}>
            <ProviderCardSkeleton />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}

export function ProviderGridSkeleton() {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={token.paddingLG}>
      <ProviderGroupSkeleton title="Local Providers" count={3} />
      <ProviderGroupSkeleton title="OAuth Providers" count={4} />
      <ProviderGroupSkeleton title="API Key Providers" count={8} />
    </Flex>
  );
}
