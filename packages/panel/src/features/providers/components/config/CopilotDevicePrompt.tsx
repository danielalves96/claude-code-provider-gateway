import { CheckOutlined } from "@ant-design/icons";
import { Badge, Button, Flex, Space, Typography, theme } from "antd";
import { useCopyToClipboard } from "../../../../shared/hooks/useCopyToClipboard.js";
import { openExternal } from "../../../../shared/openExternal.js";
import type { CopilotFlow } from "../../domain/types.js";

const { Text, Link } = Typography;

interface CopilotDevicePromptProps {
  flow: CopilotFlow;
  waitingText: string;
  approvalSite: string;
  onCancel: () => void;
}

export function CopilotDevicePrompt({
  flow,
  waitingText,
  approvalSite,
  onCancel,
}: CopilotDevicePromptProps) {
  const { token } = theme.useToken();
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey === flow.flowId;

  return (
    <Flex
      vertical
      gap={token.paddingSM}
      style={{
        padding: `${token.paddingSM}px ${token.padding}px`,
        border: `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <Text type="secondary">
        Step 1 — Enter this code on {approvalSite} (already opened in a new tab):
      </Text>
      <Space>
        <Text
          code
          style={{
            fontSize: token.fontSizeXL,
            letterSpacing: 6,
            color: token.colorPrimaryText,
            padding: `${token.paddingXXS}px ${token.paddingSM}px`,
          }}
        >
          {flow.userCode}
        </Text>
        <Button
          icon={copied ? <CheckOutlined /> : undefined}
          onClick={() => copy(flow.flowId, flow.userCode)}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Space>
      <Text type="secondary">
        Step 2 — Approve access on{" "}
        <Link
          href={flow.verificationUri}
          onClick={(e) => {
            e.preventDefault();
            openExternal(flow.verificationUri);
          }}
        >
          {flow.verificationUri}
        </Link>
      </Text>
      <Space>
        <Badge status="processing" text={<Text type="secondary">{waitingText}</Text>} />
        <Button onClick={onCancel}>Cancel</Button>
      </Space>
    </Flex>
  );
}
