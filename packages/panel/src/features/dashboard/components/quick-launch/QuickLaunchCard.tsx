import { CodeOutlined, CopyOutlined } from "@ant-design/icons";
import { Card, Divider, Empty, Flex, Tooltip, Typography, theme } from "antd";
import { useCopyToClipboard } from "../../../../shared/hooks/useCopyToClipboard.js";
import type { LaunchItem } from "../../domain/types.js";

const { Text } = Typography;

interface QuickLaunchCardProps {
  items: LaunchItem[];
  error?: Error | null;
}

export function QuickLaunchCard({ items, error }: QuickLaunchCardProps) {
  const { copiedKey, copy } = useCopyToClipboard();
  const { token } = theme.useToken();

  return (
    <Card
      style={{
        borderColor: token.colorBorderSecondary,
        boxShadow: token.boxShadow,
      }}
      styles={{
        header: {
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: `${token.padding}px ${token.paddingLG}px`,
        },
        body: { padding: token.paddingLG },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <div
            style={{
              color: token.colorWarning,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${token.colorWarning}20 0%, ${token.colorBgContainer} 100%)`,
              border: `1px solid ${token.colorWarning}30`,
              boxShadow: `0 0 10px ${token.colorWarning}10`,
            }}
          >
            <CodeOutlined />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            Quick Launch
          </Text>
        </Flex>
      }
    >
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
  const providerItems = items.filter((item) => !isChainLaunchItem(item));
  const chainItems = items.filter(isChainLaunchItem);

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
    <Flex vertical gap={token.padding}>
      <Text type="secondary" style={{ fontSize: 14 }}>
        Run Claude Code with a provider or Model Chain shortcut:
      </Text>
      {providerItems.length > 0 && (
        <Flex wrap gap={token.padding}>
          {providerItems.map((item) => (
            <QuickLaunchTag
              key={item.id}
              item={item}
              copied={copiedKey === item.id}
              onCopy={onCopy}
            />
          ))}
        </Flex>
      )}
      {chainItems.length > 0 && (
        <>
          <Divider style={{ margin: `${token.marginXS}px 0 0` }} />
          <Flex vertical gap={token.paddingSM}>
            <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>
              Model Chains
            </Text>
            <Flex wrap gap={token.padding}>
              {chainItems.map((item) => (
                <QuickLaunchTag
                  key={item.id}
                  item={item}
                  copied={copiedKey === item.id}
                  onCopy={onCopy}
                />
              ))}
            </Flex>
          </Flex>
        </>
      )}
    </Flex>
  );
}

function isChainLaunchItem(item: LaunchItem): boolean {
  return item.id.startsWith("chain:") || item.id === "model-chains";
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
  const isChain = isChainLaunchItem(item);

  return (
    <Tooltip title={copied ? "Copied!" : `Copy ${item.label}`}>
      <button
        type="button"
        onClick={() => onCopy(item.id, item.cmd)}
        style={{
          cursor: "pointer",
          background: copied ? `${token.colorSuccess}15` : `${token.colorText}08`,
          border: `1px solid ${copied ? token.colorSuccess : token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: `6px 12px`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          transition: "all 0.2s",
          fontFamily: "inherit",
        }}
      >
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 500,
            color: copied ? token.colorSuccess : token.colorWarning,
          }}
        >
          {item.badge}
        </Text>
        {isChain && (
          <Text
            style={{
              fontSize: 11,
              color: token.colorPrimary,
              background: `${token.colorPrimary}12`,
              border: `1px solid ${token.colorPrimary}30`,
              borderRadius: 999,
              padding: "1px 7px",
              lineHeight: "18px",
            }}
          >
            Chain
          </Text>
        )}
        <CopyOutlined style={{ color: copied ? token.colorSuccess : token.colorTextTertiary }} />
      </button>
    </Tooltip>
  );
}
