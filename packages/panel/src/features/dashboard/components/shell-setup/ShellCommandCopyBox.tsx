import { CopyOutlined } from "@ant-design/icons";
import { Button, Flex, Typography, theme } from "antd";

const { Paragraph } = Typography;

interface ShellCommandCopyBoxProps {
  command: string;
  copied: boolean;
  onCopy: (key: string, value: string) => void;
}

export function ShellCommandCopyBox({ command, copied, onCopy }: ShellCommandCopyBoxProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      align="center"
      gap={token.paddingXS}
      style={{
        background: token.colorFillTertiary,
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadius,
      }}
    >
      <Paragraph
        code
        copyable={false}
        style={{
          flex: 1,
          margin: 0,
          fontSize: 12,
          overflow: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {command}
      </Paragraph>
      <Button
        size="small"
        icon={<CopyOutlined />}
        type={copied ? "primary" : "default"}
        onClick={() => onCopy("oneliner", command)}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </Flex>
  );
}
