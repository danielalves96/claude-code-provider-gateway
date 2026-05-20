import { CopyOutlined } from "@ant-design/icons";
import { App, Tooltip, Typography, theme } from "antd";
import { useCopyToClipboard } from "../../../../shared/hooks/useCopyToClipboard.js";

const { Text } = Typography;

export function CopySnippet({ snippet }: { snippet: string }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey === snippet;

  return (
    <Tooltip title={copied ? "Copied!" : "Copy"}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copy(snippet, snippet);
          message.success("Command copied to clipboard");
        }}
        style={{
          cursor: "pointer",
          background: copied ? `${token.colorSuccess}15` : `${token.colorText}08`,
          border: `1px solid ${copied ? token.colorSuccess : token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: `6px 12px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          transition: "all 0.2s",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 500,
            color: copied ? token.colorSuccess : token.colorText,
          }}
          ellipsis
        >
          {snippet}
        </Text>
        <CopyOutlined style={{ color: copied ? token.colorSuccess : token.colorTextTertiary }} />
      </button>
    </Tooltip>
  );
}
