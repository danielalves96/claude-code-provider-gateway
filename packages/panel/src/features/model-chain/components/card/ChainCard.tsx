import { BranchesOutlined, DeleteOutlined, EditOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Space, Switch, Tag, Typography, theme } from "antd";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ModelFallbackConfig, RoutingOption } from "../../domain/types.js";
import { CopySnippet } from "./CopySnippet.js";

const { Text, Title } = Typography;

interface ChainCardProps {
  chain: ModelFallbackConfig;
  options: RoutingOption[];
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

export function ChainCard({
  chain,
  options,
  saving,
  onEdit,
  onDelete,
  onToggleEnabled,
}: ChainCardProps) {
  const { token } = theme.useToken();

  const isRoundRobin = chain.routingStrategy === "round_robin";

  return (
    <Card
      hoverable
      styles={{ body: { padding: token.paddingLG } }}
      style={{
        height: "100%",
        borderColor: chain.enabled ? token.colorPrimaryBorder : token.colorBorderSecondary,
      }}
    >
      <Flex vertical gap={token.padding}>
        <Flex justify="space-between" align="flex-start" gap={token.padding}>
          <Flex vertical gap={12} style={{ minWidth: 0, flex: 1 }}>
            <Space wrap>
              <Title level={5} style={{ margin: 0 }}>
                {chain.name}
              </Title>
              <Tag
                color={chain.enabled ? "success" : "error"}
                bordered={false}
                style={{ fontFamily: "monospace", margin: 0 }}
              >
                {chain.enabled ? "Enabled" : "Disabled"}
              </Tag>
              {isRoundRobin ? (
                <Tag icon={<SyncOutlined />} color="purple" bordered={false} style={{ margin: 0 }}>
                  Round Robin
                </Tag>
              ) : (
                <Tag
                  icon={<BranchesOutlined />}
                  color="geekblue"
                  bordered={false}
                  style={{ margin: 0 }}
                >
                  Waterfall
                </Tag>
              )}
            </Space>
            <div style={{ maxWidth: 280 }}>
              <CopySnippet snippet={`ccpg --${chain.slug}`} />
            </div>
          </Flex>
          <Space>
            <Switch
              aria-label={`Enable ${chain.name} chain`}
              checked={chain.enabled}
              onChange={onToggleEnabled}
              disabled={saving}
              style={{ marginRight: 8 }}
            />
            <Button
              aria-label={`Edit ${chain.name}`}
              icon={<EditOutlined />}
              onClick={onEdit}
              disabled={saving}
            />
            <Button
              danger
              aria-label={`Delete ${chain.name}`}
              icon={<DeleteOutlined />}
              disabled={saving}
              onClick={onDelete}
            />
          </Space>
        </Flex>

        <Flex vertical gap={8} style={{ marginTop: 8 }}>
          {chain.models.map((entry, index) => {
            const provider = options.find((option) => option.id === entry.providerId);
            const model = provider?.models.find((item) => item.id === entry.model);
            return (
              <Flex
                key={`${entry.providerId}/${entry.model}`}
                align="center"
                gap={token.paddingSM}
                style={{
                  padding: token.paddingSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  background: token.colorFillQuaternary,
                }}
              >
                <Tag
                  color={isRoundRobin ? "purple" : index === 0 ? "blue" : "default"}
                  bordered={false}
                  style={{ fontFamily: "monospace" }}
                >
                  {isRoundRobin ? `~${index + 1}` : `#${index + 1}`}
                </Tag>
                <ProviderLogo
                  providerId={entry.providerId}
                  label={provider?.label ?? entry.providerId}
                  size={22}
                />
                <Flex vertical style={{ minWidth: 0 }}>
                  <Text strong ellipsis style={{ fontSize: 14 }}>
                    {provider?.label ?? entry.providerId}
                  </Text>
                  <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                    {model?.display_name ?? entry.model}
                  </Text>
                </Flex>
              </Flex>
            );
          })}
        </Flex>
      </Flex>
    </Card>
  );
}
