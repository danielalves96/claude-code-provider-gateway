import { PoweroffOutlined } from "@ant-design/icons";
import { App, Badge, Button, Flex, Layout, Popconfirm, Tooltip, Typography, theme } from "antd";
import { useState } from "react";
import { daemonControl } from "./daemonControl.js";
import { type DaemonState, useDaemonStatus } from "./useDaemonStatus.js";

const { Header } = Layout;
const { Text } = Typography;

const STATE_LABEL: Record<DaemonState, string> = {
  running: "Gateway running",
  offline: "Gateway stopped",
  unknown: "Checking...",
};

const STATE_BADGE: Record<DaemonState, "success" | "error" | "processing"> = {
  running: "success",
  offline: "error",
  unknown: "processing",
};

export function TopBar() {
  const { token } = theme.useToken();
  const { state, refresh, pause, resume } = useDaemonStatus();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const isRunning = state === "running";
  const canStartFromPanel = daemonControl.canStartFromPanel();

  const handleStop = async () => {
    setBusy(true);
    pause();
    try {
      await daemonControl.stop();
      message.success("Stop signal sent");
      // Give the daemon ~500ms to actually exit before resuming polling.
      setTimeout(() => {
        void refresh();
        resume();
      }, 500);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to stop gateway");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    try {
      await daemonControl.start();
      message.success("Gateway started");
      setTimeout(() => void refresh(), 500);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to start gateway");
    } finally {
      setBusy(false);
    }
  };

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
          <Badge status={STATE_BADGE[state]} />
          <Text strong>{STATE_LABEL[state]}</Text>
        </Flex>
        <ControlButton
          isRunning={isRunning}
          busy={busy}
          canStart={canStartFromPanel}
          onStop={handleStop}
          onStart={handleStart}
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
