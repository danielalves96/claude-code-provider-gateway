import { Divider, Flex, Segmented, Switch, Typography, theme } from "antd";
import type { TokenSaversConfig } from "../types.js";

const { Text } = Typography;

interface TokenSaversCardProps {
  value: TokenSaversConfig;
  onChange: (patch: Partial<TokenSaversConfig>) => void;
}

export function TokenSaversCard({ value, onChange }: TokenSaversCardProps) {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={token.padding}>
      <ToggleRow
        title="RTK compression"
        description="Compact large tool results before provider dispatch"
        checked={value.rtkEnabled}
        onChange={(v) => onChange({ rtkEnabled: v })}
      />

      <Divider style={{ margin: 0, borderColor: token.colorBorderSecondary }} />

      <ToggleRow
        title="Caveman mode"
        description="Inject terse-response guidance into the system prompt"
        checked={value.cavemanEnabled}
        onChange={(v) => onChange({ cavemanEnabled: v })}
      />

      <Flex vertical gap={token.paddingXS}>
        <Text strong style={{ opacity: value.cavemanEnabled ? 1 : 0.4 }}>
          Caveman level
        </Text>
        <Segmented
          aria-label="Caveman mode level"
          disabled={!value.cavemanEnabled}
          value={value.cavemanLevel}
          options={[
            { label: "Lite", value: "lite" },
            { label: "Full", value: "full" },
            { label: "Ultra", value: "ultra" },
          ]}
          onChange={(v) => onChange({ cavemanLevel: v as TokenSaversConfig["cavemanLevel"] })}
        />
      </Flex>
    </Flex>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <Flex justify="space-between" align="center" gap={16}>
      <Flex vertical>
        <Text strong style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {description}
        </Text>
      </Flex>
      <Switch aria-label={title} checked={checked} onChange={onChange} />
    </Flex>
  );
}
