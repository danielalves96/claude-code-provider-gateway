import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Space, Tag, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

interface ExtraModelsSectionProps {
  models: string[];
  onAdd: (model: string) => void;
  onRemove: (model: string) => void;
}

export function ExtraModelsSection({ models, onAdd, onRemove }: ExtraModelsSectionProps) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const alreadyAdded = models.includes(trimmed);

  const submit = () => {
    if (!trimmed || alreadyAdded) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <Flex vertical gap={4}>
      <Text type="secondary">
        <Space>
          <PlusOutlined />
          Extra models
        </Space>
      </Text>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={draft}
            placeholder="gpt-5.6-codex"
            style={{ fontFamily: "monospace" }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!trimmed || alreadyAdded}
            onClick={submit}
          />
        </Space.Compact>
        {models.length > 0 && (
          <Space wrap>
            {models.map((model) => (
              <Tag
                key={model}
                closable
                onClose={() => onRemove(model)}
                style={{ fontFamily: "monospace" }}
              >
                {model}
              </Tag>
            ))}
          </Space>
        )}
      </Space>
    </Flex>
  );
}
