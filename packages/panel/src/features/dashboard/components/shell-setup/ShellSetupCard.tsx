import { CodeOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Space, Typography, theme } from "antd";
import type { ShellSetup } from "../../domain/types.js";
import { useShellSetupCard } from "../../hooks/useShellSetupCard.js";
import { ShellInstallActions, ShellInstallSummary } from "./ShellInstallActions.js";
import { ShellSetupManualCommand } from "./ShellSetupManualCommand.js";

const { Text } = Typography;

interface ShellSetupCardProps {
  setup: ShellSetup;
  panelPort: number;
  defaultOpen: boolean;
  canDismiss: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function ShellSetupCard({
  setup,
  panelPort,
  defaultOpen,
  canDismiss,
  onRefresh,
  onDismiss,
}: ShellSetupCardProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const card = useShellSetupCard({ defaultOpen, onRefresh, message });

  return (
    <Card
      style={{
        borderColor: token.colorBorderSecondary,
        boxShadow: token.boxShadow,
      }}
      styles={{
        header: {
          borderBottom: card.open ? `1px solid ${token.colorBorderSecondary}` : 0,
          padding: `${token.padding}px ${token.paddingLG}px`,
        },
        body: {
          display: card.open ? undefined : "none",
          padding: token.paddingLG,
        },
      }}
      title={
        <Flex align="center" gap={token.paddingSM}>
          <div
            style={{
              color: token.colorInfo,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${token.colorInfo}20 0%, ${token.colorBgContainer} 100%)`,
              border: `1px solid ${token.colorInfo}30`,
              boxShadow: `0 0 10px ${token.colorInfo}10`,
            }}
          >
            <CodeOutlined />
          </div>
          <Text strong style={{ fontSize: 16 }}>
            Terminal Integration
          </Text>
        </Flex>
      }
      extra={
        <Space>
          <ShellInstallSummary shells={setup.shells} />
          {canDismiss && (
            <Button type="text" size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          <Button type="primary" ghost size="small" onClick={card.toggleOpen}>
            {card.open ? "Hide Details" : "Configure"}
          </Button>
        </Space>
      }
    >
      {card.open && (
        <Flex vertical gap={token.paddingLG}>
          <ShellInstallActions
            shells={setup.shells}
            installingShell={card.installingShell}
            onInstall={card.install}
          />
          <ShellSetupManualCommand
            setup={setup}
            panelPort={panelPort}
            copiedKey={card.copiedKey}
            onCopy={card.copy}
          />
        </Flex>
      )}
    </Card>
  );
}
