import { EditOutlined, LinkOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Space, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

interface BaseUrlSectionProps {
  baseUrl?: string;
  onRequestChange: (value: string) => void;
}

export function BaseUrlSection({ baseUrl, onRequestChange }: BaseUrlSectionProps) {
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
    <Flex vertical gap={4}>
      <Text type="secondary">
        <Space>
          <LinkOutlined />
          Base URL
        </Space>
      </Text>
      {!editing ? (
        <Space>
          <Text code style={{ fontFamily: "monospace" }}>
            {baseUrl ?? "—"}
          </Text>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(true);
              setDraft(baseUrl ?? "");
            }}
          />
        </Space>
      ) : (
        <Flex vertical gap={8} style={{ width: "100%", maxWidth: 520 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              autoFocus
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
              type="primary"
              disabled={!draft.trim() || draft.trim() === baseUrl}
              onClick={submit}
            >
              Save
            </Button>
            <Button onClick={cancel}>Cancel</Button>
          </Space.Compact>
          <Text type="warning" style={{ fontSize: 12 }}>
            <Space size={6}>
              <WarningOutlined />
              Provider credentials are sent to this endpoint. Use only URLs you trust.
            </Space>
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
