import { Divider, Flex, Switch, Typography, theme } from "antd";
import type { WebToolsConfig } from "../../domain/types.js";

const { Text } = Typography;

interface WebToolsCardProps {
  value: WebToolsConfig;
  onChange: (patch: Partial<WebToolsConfig>) => void;
}

export function WebToolsCard({ value, onChange }: WebToolsCardProps) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.padding}>
      <ToggleRow
        title="Enable web_search / web_fetch"
        description="Allows Claude to search the web and fetch URLs"
        checked={value.enabled}
        onChange={(v) => onChange({ enabled: v })}
      />

      <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />

      <ToggleRow
        title="Allow private networks"
        description="Permit fetching RFC1918 addresses (192.168.x, 10.x…)"
        checked={value.allowPrivateNetworks}
        disabled={!value.enabled}
        onChange={(v) => onChange({ allowPrivateNetworks: v })}
      />
    </Flex>
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
  const labelId = `web-tools-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <Flex justify="space-between" align="center" gap={16}>
      <Flex vertical>
        <Text id={labelId} strong style={{ opacity: disabled ? 0.4 : 1, fontSize: 15 }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 13, opacity: disabled ? 0.6 : 1 }}>
          {description}
        </Text>
      </Flex>
      <Switch aria-labelledby={labelId} checked={checked} disabled={disabled} onChange={onChange} />
    </Flex>
  );
}
