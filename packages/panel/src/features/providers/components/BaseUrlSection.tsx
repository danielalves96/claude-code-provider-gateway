import { CloseOutlined, EditOutlined, LinkOutlined, SaveOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Input, Space, Typography, theme } from "antd";
import { useState } from "react";

const { Text } = Typography;

interface BaseUrlSectionProps {
  baseUrl?: string;
  onRequestChange: (value: string) => void;
}

export function BaseUrlSection({ baseUrl, onRequestChange }: BaseUrlSectionProps) {
  const { token } = theme.useToken();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseUrl ?? "");

  const cancel = () => {
    setEditing(false);
    setDraft(baseUrl ?? "");
  };

  const submit = () => {
    const value = draft.trim();
    if (!value || value === baseUrl) {
      cancel();
      return;
    }
    onRequestChange(value);
    setEditing(false);
  };

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <Flex vertical gap={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Text strong>
            <Space>
              <LinkOutlined style={{ color: token.colorPrimary }} />
              Custom Base URL
            </Space>
          </Text>
          {!editing ? (
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(true);
                setDraft(baseUrl ?? "");
              }}
            >
              Edit
            </Button>
          ) : (
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={cancel} />
          )}
        </div>

        {!editing ? (
          <Input disabled size="large" value={baseUrl || "—"} style={{ fontFamily: "monospace" }} />
        ) : (
          <Flex vertical gap={12}>
            <Flex gap={8}>
              <Input
                autoFocus
                size="large"
                placeholder="http://localhost:..."
                value={draft}
                style={{ fontFamily: "monospace" }}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") cancel();
                }}
              />
              <Button
                size="large"
                type="primary"
                icon={<SaveOutlined />}
                disabled={!draft.trim() || draft.trim() === baseUrl}
                onClick={submit}
              >
                Save URL
              </Button>
            </Flex>
            <Alert
              type="warning"
              showIcon
              message="Provider credentials are sent to this endpoint. Use only URLs you trust."
              style={{ fontSize: 13, padding: "6px 12px" }}
            />
          </Flex>
        )}
      </Flex>
    </div>
  );
}
