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
        padding: 16,
        backgroundColor: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <Flex vertical gap={12}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            size="large"
            value={keyPreview ?? "••••••••••••••••"}
            style={{ fontFamily: "monospace" }}
          />
        ) : (
          <Flex gap={8}>
            <Input.Password
              autoFocus={editing}
              size="large"
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
              size="large"
              type="primary"
              icon={<SaveOutlined />}
              disabled={!draft.trim()}
              onClick={submit}
            >
              Save Key
            </Button>
          </Flex>
        )}
      </Flex>
    </div>
  );
}
