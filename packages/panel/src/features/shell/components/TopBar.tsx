import { PoweroffOutlined } from "@ant-design/icons";
import { App, Badge, Button, Flex, Layout, Popconfirm, Tooltip, Typography, theme } from "antd";
import { STATE_BADGE, STATE_LABEL, useGatewayControl } from "../hooks/useGatewayControl.js";

const { Header } = Layout;
const { Text } = Typography;

export function TopBar() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const control = useGatewayControl({ message });

  return (
    <Header
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        padding: `0 ${token.paddingLG}px`,
        height: 56,
        lineHeight: "56px",
      }}
    >
      <Flex justify="space-between" align="center" style={{ height: "100%" }}>
        <Flex align="center" gap={token.paddingSM}>
          <Badge status={STATE_BADGE[control.state]} />
          <Text strong>{STATE_LABEL[control.state]}</Text>
        </Flex>
        <ControlButton
          isRunning={control.isRunning}
          busy={control.busy}
          canStart={control.canStartFromPanel}
          onStop={control.stop}
          onStart={control.start}
        />
      </Flex>
    </Header>
  );
}

function ControlButton({
  isRunning,
  busy,
  canStart,
  onStop,
  onStart,
}: {
  isRunning: boolean;
  busy: boolean;
  canStart: boolean;
  onStop: () => void;
  onStart: () => void;
}) {
  if (isRunning) {
    return (
      <Popconfirm
        title="Stop gateway?"
        description="The proxy will be unavailable until the gateway starts again."
        okText="Stop"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        onConfirm={onStop}
      >
        <Button danger icon={<PoweroffOutlined />} loading={busy}>
          Stop
        </Button>
      </Popconfirm>
    );
  }

  if (!canStart) {
    return (
      <Tooltip title="In development, restart it with `bun dev:desk`">
        <Button icon={<PoweroffOutlined />} disabled>
          Start
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button type="primary" icon={<PoweroffOutlined />} loading={busy} onClick={onStart}>
      Start
    </Button>
  );
}
