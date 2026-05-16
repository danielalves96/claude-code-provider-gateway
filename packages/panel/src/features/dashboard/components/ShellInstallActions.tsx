import { CheckCircleFilled, DownloadOutlined, LoadingOutlined } from "@ant-design/icons";
import { Button, Flex, Space, Tag, Tooltip, Typography, theme } from "antd";
import type { ShellInfo, ShellName } from "../types.js";
import { SHELL_DISPLAY_NAMES } from "./shellSetupDisplay.js";

const { Text } = Typography;

interface ShellInstallActionsProps {
  shells: ShellInfo[];
  installingShell: ShellName | "all" | null;
  onInstall: (shells: ShellName[], key: ShellName | "all") => void;
}

export function ShellInstallActions({
  shells,
  installingShell,
  onInstall,
}: ShellInstallActionsProps) {
  const { token } = theme.useToken();
  const allInstalled = shells.every((shell) => shell.installed || !shell.rcExists);
  const installableShells = shells.filter((shell) => !shell.installed);

  return (
    <Flex wrap gap={token.paddingXS} align="center">
      {shells.map((shell) => (
        <ShellInstallButton
          key={shell.name}
          shell={shell}
          busy={installingShell === shell.name}
          disabledByOthers={installingShell !== null && installingShell !== shell.name}
          onClick={() => onInstall([shell.name], shell.name)}
        />
      ))}
      {installableShells.length > 1 && !allInstalled && (
        <Button
          type="primary"
          icon={installingShell === "all" ? <LoadingOutlined /> : <DownloadOutlined />}
          loading={installingShell === "all"}
          disabled={installingShell !== null && installingShell !== "all"}
          onClick={() =>
            onInstall(
              installableShells.map((shell) => shell.name),
              "all",
            )
          }
        >
          Add to all
        </Button>
      )}
    </Flex>
  );
}

export function ShellInstallSummary({ shells }: { shells: ShellInfo[] }) {
  const installed = shells.filter((shell) => shell.installed);

  if (installed.length === 0) {
    return <Tag>Not installed</Tag>;
  }

  return (
    <Space size={4}>
      <CheckCircleFilled style={{ color: "#52c41a" }} />
      <Text type="secondary">
        Installed in {installed.map((shell) => SHELL_DISPLAY_NAMES[shell.name]).join(", ")}
      </Text>
    </Space>
  );
}

function ShellInstallButton({
  shell,
  busy,
  disabledByOthers,
  onClick,
}: {
  shell: ShellInfo;
  busy: boolean;
  disabledByOthers: boolean;
  onClick: () => void;
}) {
  const displayName = SHELL_DISPLAY_NAMES[shell.name];

  if (shell.installed) {
    return (
      <Tooltip title={`Already in ${shell.rcPath}`}>
        <Button icon={<CheckCircleFilled style={{ color: "#52c41a" }} />} disabled>
          {displayName}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`Writes to ${shell.rcPath}`}>
      <Button
        icon={busy ? <LoadingOutlined /> : <DownloadOutlined />}
        loading={busy}
        disabled={disabledByOthers}
        onClick={onClick}
      >
        Add to {displayName}
      </Button>
    </Tooltip>
  );
}
