import { Card, Empty, Flex, Tag, Tooltip, Typography, theme } from "antd";
import { useCopyToClipboard } from "../../../shared/hooks/useCopyToClipboard.js";
import type { LaunchItem } from "../types.js";

const { Text } = Typography;

interface QuickLaunchCardProps {
  items: LaunchItem[];
  error?: Error | null;
}

export function QuickLaunchCard({ items, error }: QuickLaunchCardProps) {
  const { copiedKey, copy } = useCopyToClipboard();

  return (
    <Card title="Quick Launch">
      <AvailableProviders items={items} error={error} copiedKey={copiedKey} onCopy={copy} />
    </Card>
  );
}

function AvailableProviders({
  items,
  error,
  copiedKey,
  onCopy,
}: {
  items: LaunchItem[];
  error?: Error | null;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  const { token } = theme.useToken();

  if (error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`Quick Launch unavailable: ${error.message}`}
        style={{ margin: 0 }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No providers enabled yet - enable one in the Providers tab"
        style={{ margin: 0 }}
      />
    );
  }

  return (
    <Flex vertical gap={token.paddingXS}>
      <Text type="secondary" style={{ fontSize: 14 }}>
        Available in your terminal:
      </Text>
      <Flex wrap gap={token.paddingXS}>
        {items.map((item) => (
          <QuickLaunchTag
            key={item.id}
            item={item}
            copied={copiedKey === item.id}
            onCopy={onCopy}
          />
        ))}
      </Flex>
    </Flex>
  );
}

function QuickLaunchTag({
  item,
  copied,
  onCopy,
}: {
  item: LaunchItem;
  copied: boolean;
  onCopy: (key: string, value: string) => void;
}) {
  const { token } = theme.useToken();
  const textColor = copied ? token.colorSuccessText : token.colorInfoText;

  return (
    <Tooltip title={copied ? "Copied!" : `Click to copy: ${item.cmd}`}>
      <Tag
        color={copied ? "success" : "processing"}
        onClick={() => onCopy(item.id, item.cmd)}
        style={{ margin: 0, fontFamily: "monospace", color: textColor, cursor: "pointer" }}
      >
        {item.badge}
      </Tag>
    </Tooltip>
  );
}
