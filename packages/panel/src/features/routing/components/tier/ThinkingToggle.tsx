import { BulbOutlined } from "@ant-design/icons";
import { Flex, Space, Switch, Typography, theme } from "antd";

const { Text } = Typography;

interface ThinkingToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function ThinkingToggle({ checked, onChange }: ThinkingToggleProps) {
  const { token } = theme.useToken();
  return (
    <Space>
      <BulbOutlined style={{ color: token.colorWarning, fontSize: token.fontSizeLG }} />
      <Flex vertical>
        <Text strong>Enable thinking blocks</Text>
        <Text type="secondary">Extended reasoning for supported models</Text>
      </Flex>
      <Switch checked={checked} onChange={onChange} />
    </Space>
  );
}
