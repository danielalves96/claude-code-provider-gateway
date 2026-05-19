import { ArrowRightOutlined } from "@ant-design/icons";
import { Card, Col, Flex, Row, Skeleton, Space, theme } from "antd";
import { TIERS } from "../../domain/constants.js";

function TierCardSkeleton() {
  const { token } = theme.useToken();

  return (
    <Card
      style={{ width: "100%", display: "flex", flexDirection: "column" }}
      styles={{
        body: { flex: 1, display: "flex", flexDirection: "column", padding: token.paddingLG },
      }}
    >
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: token.marginLG }}>
        <Space size="middle" align="center">
          <Skeleton.Button active size="small" shape="round" style={{ width: 72 }} />
          <Skeleton.Input active size="small" style={{ width: 180 }} />
        </Space>
        <Space size="small">
          <Skeleton.Input active size="small" style={{ width: 56 }} />
          <Skeleton.Button active size="small" shape="round" style={{ width: 40 }} />
        </Space>
      </Flex>

      <Flex align="flex-end" gap={token.padding} style={{ flex: 1 }}>
        <Flex vertical style={{ flex: 1 }} gap={token.marginXS}>
          <Skeleton.Input active size="small" style={{ width: 72 }} />
          <Skeleton.Input active block size="default" />
        </Flex>

        <div style={{ paddingBottom: 6 }}>
          <ArrowRightOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </div>

        <Flex vertical style={{ flex: 1 }} gap={token.marginXS}>
          <Skeleton.Input active size="small" style={{ width: 52 }} />
          <Skeleton.Input active block size="default" />
        </Flex>
      </Flex>
    </Card>
  );
}

export function RoutingGridSkeleton() {
  const { token } = theme.useToken();

  return (
    <Row gutter={[token.paddingLG, token.paddingLG]} align="stretch">
      {TIERS.map((tier) => (
        <Col xs={24} xl={12} key={tier} style={{ display: "flex" }}>
          <TierCardSkeleton />
        </Col>
      ))}
    </Row>
  );
}
