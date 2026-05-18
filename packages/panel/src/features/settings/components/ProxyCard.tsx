import { Divider, Flex, Input, Switch, Typography, theme } from "antd";
import type { ProxyConfig } from "../types.js";

const { Text } = Typography;

interface ProxyCardProps {
  value: ProxyConfig;
  onChange: (patch: Partial<ProxyConfig>) => void;
}

export function ProxyCard({ value, onChange }: ProxyCardProps) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.padding}>
      <Flex justify="space-between" align="center" gap={16}>
        <Flex vertical>
          <Text strong style={{ fontSize: 15 }}>
            Enable outbound proxy
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Route OpenAI OAuth and external provider requests through a proxy
          </Text>
        </Flex>
        <Switch checked={value.enabled} onChange={(v) => onChange({ enabled: v })} />
      </Flex>

      <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />

      <Flex vertical gap={token.paddingXS}>
        <Text strong style={{ opacity: value.enabled ? 1 : 0.4 }}>
          Proxy URL
        </Text>
        <Input
          disabled={!value.enabled}
          placeholder="http://127.0.0.1:7890"
          value={value.url}
          onChange={(e) => onChange({ url: e.target.value })}
        />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          Takes effect on next gateway restart.
        </Text>
      </Flex>
    </Flex>
  );
}
