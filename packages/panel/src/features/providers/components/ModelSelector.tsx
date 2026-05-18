import { CaretDownOutlined, CaretRightOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Checkbox, Col, Flex, Input, Row, Space, Spin, Tag, Typography, theme } from "antd";
import { useMemo, useState } from "react";
import type { ModelInfo } from "../types.js";
import { stripModelPrefix } from "../utils.js";

const { Text } = Typography;

interface ModelSelectorProps {
  models: ModelInfo[] | null;
  loading: boolean;
  disabledModels: string[];
  ready: boolean;
  onDisabledModelsChange: (disabled: string[]) => void;
}

export function ModelSelector({
  models,
  loading,
  disabledModels,
  ready,
  onDisabledModelsChange,
}: ModelSelectorProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  const disabledSet = useMemo(() => new Set(disabledModels), [disabledModels]);
  const total = models?.length ?? 0;
  const activeCount = total - disabledSet.size;
  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!models) return [];
    if (!query) return models;
    return models.filter((m) => stripModelPrefix(m.display_name).toLowerCase().includes(query));
  }, [models, query]);

  const allDisabled = total > 0 && disabledSet.size === total;
  const someDisabled = disabledSet.size > 0 && disabledSet.size < total;

  const toggle = () => setExpanded((v) => !v);

  const toggleModel = (id: string, checked: boolean) => {
    const next = new Set(disabledSet);
    if (checked) next.delete(id);
    else next.add(id);
    onDisabledModelsChange([...next]);
  };

  const toggleAll = () => {
    onDisabledModelsChange(disabledSet.size === 0 ? (models ?? []).map((m) => m.id) : []);
  };

  return (
    <Flex vertical gap={token.paddingXS}>
      <Button
        type="text"
        disabled={!ready}
        icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        onClick={toggle}
      >
        Active models
        {models !== null && (
          <Tag
            color={activeCount === 0 ? "error" : "processing"}
            style={{ marginLeft: token.marginXS }}
          >
            {activeCount}/{total}
          </Tag>
        )}
      </Button>

      {expanded && (
        <Flex vertical gap={token.marginSM}>
          {loading && (
            <Space>
              <Spin size="small" />
              <Text type="secondary">Loading models…</Text>
            </Space>
          )}

          {!loading && models?.length === 0 && <Text type="secondary">No models found</Text>}

          {!loading && models && models.length > 0 && (
            <ModelGrid
              visible={visible}
              disabledSet={disabledSet}
              total={total}
              search={search}
              someDisabled={someDisabled}
              allDisabled={allDisabled}
              query={query}
              onSearch={setSearch}
              onToggleAll={toggleAll}
              onToggleModel={toggleModel}
            />
          )}
        </Flex>
      )}
    </Flex>
  );
}

interface ModelGridProps {
  visible: ModelInfo[];
  disabledSet: Set<string>;
  total: number;
  search: string;
  someDisabled: boolean;
  allDisabled: boolean;
  query: string;
  onSearch: (value: string) => void;
  onToggleAll: () => void;
  onToggleModel: (id: string, checked: boolean) => void;
}

function ModelGrid({
  visible,
  disabledSet,
  search,
  someDisabled,
  allDisabled,
  query,
  onSearch,
  onToggleAll,
  onToggleModel,
}: ModelGridProps) {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={token.paddingSM}>
      <Space>
        <Checkbox
          indeterminate={someDisabled}
          checked={!allDisabled && disabledSet.size === 0}
          onChange={onToggleAll}
        >
          {allDisabled ? "Enable all" : "Disable all"}
        </Checkbox>
        <Input
          placeholder="Search models…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        {query && <Text type="secondary">{visible.length} results</Text>}
      </Space>

      <Flex
        vertical
        style={{
          maxHeight: 220,
          overflowY: "auto",
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: `${token.paddingXXS}px 0`,
        }}
      >
        {visible.length === 0 ? (
          <Text type="secondary" style={{ padding: `${token.paddingXS}px ${token.paddingSM}px` }}>
            No models match "{search}"
          </Text>
        ) : (
          <Row>
            {visible.map((m) => (
              <Col span={12} key={m.id}>
                <ModelRow
                  model={m}
                  active={!disabledSet.has(m.id)}
                  onChange={(checked) => onToggleModel(m.id, checked)}
                />
              </Col>
            ))}
          </Row>
        )}
      </Flex>
    </Flex>
  );
}

interface ModelRowProps {
  model: ModelInfo;
  active: boolean;
  onChange: (checked: boolean) => void;
}

function ModelRow({ model, active, onChange }: ModelRowProps) {
  const { token } = theme.useToken();
  return (
    <Flex
      align="center"
      gap={token.paddingXS}
      style={{
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        cursor: "pointer",
      }}
    >
      <Checkbox checked={active} onChange={(e) => onChange(e.target.checked)} />
      <Text
        style={{
          fontSize: token.fontSizeSM,
          fontFamily: "monospace",
          opacity: active ? 1 : 0.35,
          textDecoration: active ? "none" : "line-through",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={model.display_name}
      >
        {stripModelPrefix(model.display_name)}
      </Text>
    </Flex>
  );
}
