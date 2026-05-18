import { CaretDownOutlined, CaretRightOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Checkbox, Col, Flex, Input, Row, Space, Spin, Tag, Typography, theme } from "antd";
import type { ModelInfo } from "../../domain/types.js";
import { stripModelPrefix } from "../../domain/utils.js";
import { useModelSelector } from "../../hooks/useModelSelector.js";

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
  const selector = useModelSelector({ models, disabledModels, onDisabledModelsChange });

  return (
    <Flex vertical gap={token.paddingXS}>
      <Button
        type="text"
        disabled={!ready}
        icon={selector.expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        onClick={selector.toggleExpanded}
      >
        Active models
        {models !== null && (
          <Tag
            color={selector.activeCount === 0 ? "error" : "processing"}
            style={{ marginLeft: token.marginXS }}
          >
            {selector.activeCount}/{selector.total}
          </Tag>
        )}
      </Button>

      {selector.expanded && (
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
              visible={selector.visibleModels}
              disabledSet={selector.disabledSet}
              search={selector.search}
              someDisabled={selector.someDisabled}
              allDisabled={selector.allDisabled}
              query={selector.query}
              onSearch={selector.setSearch}
              onToggleAll={selector.toggleAll}
              onToggleModel={selector.toggleModel}
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
