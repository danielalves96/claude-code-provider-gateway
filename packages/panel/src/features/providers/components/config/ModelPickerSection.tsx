import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Flex, Input, Space, Tag, Tooltip, Typography, theme } from "antd";
import { useMemo, useState } from "react";
import type { SuggestedModel } from "../../data/suggestedModels.js";

const { Text } = Typography;

interface ModelPickerSectionProps {
  models: string[];
  suggestions?: SuggestedModel[];
  title?: string;
  placeholder?: string;
  onAdd: (model: string) => void;
  onRemove: (model: string) => void;
}

export function ModelPickerSection({
  models,
  suggestions,
  title = "Extra models",
  placeholder = "provider/model-id",
  onAdd,
  onRemove,
}: ModelPickerSectionProps) {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  const trimmed = draft.trim();
  const alreadyAdded = models.includes(trimmed);

  const selectedSet = useMemo(() => new Set(models), [models]);

  const filteredSuggestions = useMemo(() => {
    if (!suggestions?.length) return [];
    const q = filter.toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter(
      (s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [suggestions, filter]);

  const submit = () => {
    if (!trimmed || alreadyAdded) return;
    onAdd(trimmed);
    setDraft("");
  };

  const toggleSuggestion = (id: string) => {
    if (selectedSet.has(id)) {
      onRemove(id);
    } else {
      onAdd(id);
    }
  };

  const hasSuggestions = (suggestions?.length ?? 0) > 0;

  return (
    <Flex vertical gap={token.paddingXS}>
      <Text type="secondary">
        <Space>
          <PlusOutlined />
          {title}
        </Space>
      </Text>

      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={draft}
          placeholder={placeholder}
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

      {hasSuggestions && (
        <Flex vertical gap={token.marginSM}>
          <Button
            type="text"
            icon={suggestionsExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
            onClick={() => setSuggestionsExpanded((v) => !v)}
          >
            Suggestions
            {models.length > 0 && (
              <Tag color="processing" style={{ marginLeft: token.marginXS }}>
                {models.filter((m) => suggestions!.some((s) => s.id === m)).length}/
                {suggestions!.length}
              </Tag>
            )}
          </Button>

          {suggestionsExpanded && (
            <Flex vertical gap={token.paddingXS}>
              {(suggestions?.length ?? 0) > 6 && (
                <Input
                  size="small"
                  placeholder="Filter…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{ width: 160 }}
                  allowClear
                />
              )}
              <Space wrap size={[4, 4]}>
                {filteredSuggestions.map((s) => {
                  const selected = selectedSet.has(s.id);
                  return (
                    <Tooltip key={s.id} title={s.id} placement="top">
                      <Tag
                        color={selected ? "blue" : undefined}
                        icon={selected ? <CheckOutlined /> : undefined}
                        style={{ cursor: "pointer", userSelect: "none" }}
                        onClick={() => toggleSuggestion(s.id)}
                      >
                        {s.name}
                      </Tag>
                    </Tooltip>
                  );
                })}
              </Space>
            </Flex>
          )}
        </Flex>
      )}
    </Flex>
  );
}
