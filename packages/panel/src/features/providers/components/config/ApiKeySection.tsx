import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { Button, Flex, Input, Space, Typography, theme } from "antd";
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
  const { token } = theme.useToken();
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
    <div
      style={{
        padding: 8,
      }}
    >
      <Flex vertical gap={12}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text strong>
            <Space>
              <KeyOutlined style={{ color: token.colorPrimary }} />
              API Key Authentication
            </Space>
          </Text>
          <Space wrap>
            {hasKey && !editing ? (
              <>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(true);
                    setDraft("");
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={onRequestRemove}
                >
                  Remove
                </Button>
              </>
            ) : editing ? (
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                onClick={close}
                aria-label="Close"
                title="Close"
              />
            ) : null}
          </Space>
        </div>

        {!showInput ? (
          <Input
            disabled
            value={keyPreview ?? "••••••••••••••••"}
            style={{ fontFamily: "monospace" }}
          />
        ) : (
          <Space.Compact style={{ width: "100%" }}>
            <Input.Password
              autoFocus={editing}
              placeholder="Paste your provider API key here"
              value={draft}
              style={{ fontFamily: "monospace" }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape" && editing) close();
              }}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!draft.trim()}
              onClick={submit}
            >
              Save Key
            </Button>
          </Space.Compact>
        )}
      </Flex>
    </div>
  );
}
