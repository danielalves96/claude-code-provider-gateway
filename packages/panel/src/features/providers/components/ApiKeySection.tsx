import { DeleteOutlined, EditOutlined, KeyOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Space, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

interface ApiKeySectionProps {
  hasKey: boolean;
  keyPreview: string | null;
  onSave: (value: string) => void;
  onRequestRemove: () => void;
  onRequestReplace: (value: string) => void;
}

export function ApiKeySection({
  hasKey,
  keyPreview,
  onSave,
  onRequestRemove,
  onRequestReplace,
}: ApiKeySectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const close = () => {
    setEditing(false);
    setDraft("");
  };

  const submit = () => {
    const value = draft.trim();
    if (!value) return;
    if (hasKey) onRequestReplace(value);
    else onSave(value);
    close();
  };

  const showInput = !hasKey || editing;

  return (
    <Flex vertical gap={4}>
      <Text type="secondary">
        <Space>
          <KeyOutlined />
          API Key
        </Space>
      </Text>
      {!showInput ? (
        <Space>
          <Text code style={{ fontFamily: "monospace" }}>
            {keyPreview ?? "••••••••"}
          </Text>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(true);
              setDraft("");
            }}
          />
          <Button danger icon={<DeleteOutlined />} onClick={onRequestRemove} />
        </Space>
      ) : (
        <Space.Compact style={{ width: "100%", maxWidth: 480 }}>
          <Input.Password
            autoFocus={editing}
            placeholder="paste your API key"
            value={draft}
            style={{ fontFamily: "monospace" }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape" && editing) close();
            }}
          />
          <Button type="primary" disabled={!draft.trim()} onClick={submit}>
            Save
          </Button>
          {editing && <Button onClick={close}>Cancel</Button>}
        </Space.Compact>
      )}
    </Flex>
  );
}
