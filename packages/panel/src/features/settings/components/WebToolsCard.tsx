import { GlobalOutlined } from "@ant-design/icons";
import { Card, Divider, Flex, Space, Switch, Typography, theme } from "antd";
import type { WebToolsConfig } from "../types.js";

const { Text } = Typography;

interface WebToolsCardProps {
  value: WebToolsConfig;
  onChange: (patch: Partial<WebToolsConfig>) => void;
}

export function WebToolsCard({ value, onChange }: WebToolsCardProps) {
  const { token } = theme.useToken();
  return (
    <Card
      title={
        <Space>
          <GlobalOutlined />
          Web Tools
        </Space>
      }
    >
      <Flex vertical gap={token.padding}>
        <ToggleRow
          title="Enable web_search / web_fetch"
          description="Allows Claude to search the web and fetch URLs"
          checked={value.enabled}
          onChange={(v) => onChange({ enabled: v })}
        />

        <Divider style={{ margin: 0 }} />

        <ToggleRow
          title="Allow private networks"
          description="Permit fetching RFC1918 addresses (192.168.x, 10.x…)"
          checked={value.allowPrivateNetworks}
          disabled={!value.enabled}
          onChange={(v) => onChange({ allowPrivateNetworks: v })}
        />
      </Flex>
    </Card>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, checked, disabled = false, onChange }: ToggleRowProps) {
  return (
    <Flex justify="space-between" align="flex-start">
      <Flex vertical>
        <Text strong style={{ opacity: disabled ? 0.4 : 1 }}>
          {title}
        </Text>
        <Text type="secondary">{description}</Text>
      </Flex>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </Flex>
  );
}
