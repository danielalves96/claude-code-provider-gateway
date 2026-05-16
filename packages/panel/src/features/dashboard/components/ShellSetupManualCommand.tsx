import { Flex, Space, Tag, Typography, theme } from "antd";
import { useMemo, useState } from "react";
import type { ShellName, ShellSetup } from "../types.js";
import { ShellCommandCopyBox } from "./ShellCommandCopyBox.js";
import { SHELL_DISPLAY_NAMES } from "./shellSetupDisplay.js";

const { Text } = Typography;

interface ShellSetupManualCommandProps {
  setup: ShellSetup;
  panelPort: number;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}

export function ShellSetupManualCommand({
  setup,
  panelPort,
  copiedKey,
  onCopy,
}: ShellSetupManualCommandProps) {
  const { token } = theme.useToken();
  const [pickedShell, setPickedShell] = useState<ShellName>(
    setup.currentShell ?? setup.shells[0]?.name ?? "bash",
  );
  const pickedInfo = setup.shells.find((shell) => shell.name === pickedShell);
  const command = useMemo(
    () => buildInstallCommand({ panelPort, shell: pickedShell, rcPath: pickedInfo?.rcPath }),
    [panelPort, pickedShell, pickedInfo?.rcPath],
  );

  return (
    <Flex vertical gap={token.paddingXS}>
      <ShellPicker
        shells={setup.shells.map((shell) => shell.name)}
        selectedShell={pickedShell}
        onSelect={setPickedShell}
      />
      <ShellCommandCopyBox command={command} copied={copiedKey === "oneliner"} onCopy={onCopy} />
    </Flex>
  );
}

function ShellPicker({
  shells,
  selectedShell,
  onSelect,
}: {
  shells: ShellName[];
  selectedShell: ShellName;
  onSelect: (shell: ShellName) => void;
}) {
  return (
    <Flex justify="space-between" align="center">
      <Text type="secondary" style={{ fontSize: 12 }}>
        Or paste this in any terminal:
      </Text>
      <Space size={4}>
        {shells.map((shell) => (
          <Tag
            key={shell}
            color={selectedShell === shell ? "blue" : undefined}
            style={{ cursor: "pointer", margin: 0 }}
            onClick={() => onSelect(shell)}
          >
            {SHELL_DISPLAY_NAMES[shell]}
          </Tag>
        ))}
      </Space>
    </Flex>
  );
}

function buildInstallCommand({
  panelPort,
  shell,
  rcPath,
}: {
  panelPort: number;
  shell: ShellName;
  rcPath?: string;
}) {
  if (shell === "powershell") {
    return `Invoke-RestMethod http://127.0.0.1:${panelPort}/api/shell-setup/snippet/powershell | Add-Content $PROFILE`;
  }

  return `curl -fsS http://127.0.0.1:${panelPort}/api/shell-setup/snippet/${shell} >> ${rcPath ?? `~/.${shell}rc`}`;
}
