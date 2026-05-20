import { BranchesOutlined, SyncOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Switch,
  Typography,
  theme,
} from "antd";
import type { ChainRoutingStrategy } from "../../../../../../daemon/src/config/schema.js";
import type { RoutingOption } from "../../domain/types.js";
import { normalizeSlug } from "../../domain/utils.js";
import type { DraftChain } from "../../hooks/useChainDraft.js";
import { AddModelRow } from "../form/AddModelRow.js";
import { SortableModels } from "../sortable/SortableModels.js";

const { Text } = Typography;

interface ChainModalProps {
  open: boolean;
  draft: DraftChain | null;
  options: RoutingOption[];
  existingSlugs: string[];
  onChange: (draft: DraftChain | null) => void;
  onCancel: () => void;
  onSave: (draft: DraftChain) => void;
}

interface StrategyCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function StrategyCard({ selected, onSelect, icon, label, description }: StrategyCardProps) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      onClick={onSelect}
      style={{
        flex: 1,
        cursor: "pointer",
        borderColor: selected ? token.colorPrimary : token.colorBorderSecondary,
        background: selected ? token.colorPrimaryBg : token.colorBgContainer,
        transition: "border-color 0.2s, background 0.2s",
      }}
      styles={{ body: { padding: token.paddingSM } }}
    >
      <Flex gap={token.paddingSM} align="center">
        <span
          style={{
            fontSize: 20,
            color: selected ? token.colorPrimary : token.colorTextSecondary,
            transition: "color 0.2s",
          }}
        >
          {icon}
        </span>
        <Flex vertical gap={2}>
          <Text strong style={{ color: selected ? token.colorPrimary : token.colorText }}>
            {label}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: "1.3" }}>
            {description}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}

const ATTEMPTS_HINT: Record<ChainRoutingStrategy, string> = {
  waterfall: "Number of times the primary model is tried before falling through to the next.",
  round_robin:
    "Number of times each randomly-picked model is tried before moving to the next random pick.",
};

const CHAIN_ORDER_HINT: Record<ChainRoutingStrategy, string> = {
  waterfall: "Drag to reorder · tried top-to-bottom, falls through on failure",
  round_robin:
    "Order doesn't matter · all picks are random, each failure tries another random model",
};

export function ChainModal({
  open,
  draft,
  options,
  existingSlugs,
  onChange,
  onCancel,
  onSave,
}: ChainModalProps) {
  const { token } = theme.useToken();

  const canSave =
    !!draft?.name.trim() &&
    !!draft?.slug.trim() &&
    (draft?.models.length ?? 0) >= 2 &&
    !existingSlugs.includes(normalizeSlug(draft?.slug ?? ""));

  const update = (patch: Partial<DraftChain>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal
      centered
      open={open}
      title={draft?.id.startsWith("chain_") ? "Create Model Chain" : "Edit Model Chain"}
      width={720}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          disabled={!draft || !canSave}
          onClick={() => draft && onSave(draft)}
        >
          Save chain
        </Button>,
      ]}
    >
      {draft && (
        <Flex vertical gap={token.paddingLG}>
          <Form layout="vertical">
            <Row gutter={token.padding}>
              <Col flex="1">
                <Form.Item label="Name" required>
                  <Input
                    value={draft.name}
                    placeholder="Premium Rescue"
                    onChange={(event) => {
                      const name = event.target.value;
                      update({
                        name,
                        slug: draft.slug ? draft.slug : normalizeSlug(name),
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col flex="1">
                <Form.Item
                  label="Slug"
                  required
                  validateStatus={
                    existingSlugs.includes(normalizeSlug(draft.slug)) ? "error" : undefined
                  }
                  help={
                    existingSlugs.includes(normalizeSlug(draft.slug))
                      ? "Slug already exists"
                      : "Letters, numbers, dash, underscore"
                  }
                >
                  <Input
                    prefix="--"
                    value={draft.slug}
                    placeholder="premium-rescue"
                    onChange={(event) => update({ slug: normalizeSlug(event.target.value) })}
                  />
                </Form.Item>
              </Col>
              <Col flex="none">
                <Form.Item label="Enabled">
                  <Switch checked={draft.enabled} onChange={(enabled) => update({ enabled })} />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Flex vertical gap={token.paddingSM}>
            <Text strong>Routing strategy</Text>
            <Row gutter={token.paddingSM}>
              <Col span={12}>
                <StrategyCard
                  selected={draft.routingStrategy === "waterfall"}
                  onSelect={() => update({ routingStrategy: "waterfall" })}
                  icon={<BranchesOutlined />}
                  label="Waterfall"
                  description="Always starts with the primary model. Falls through to the next only when it fails."
                />
              </Col>
              <Col span={12}>
                <StrategyCard
                  selected={draft.routingStrategy === "round_robin"}
                  onSelect={() => update({ routingStrategy: "round_robin" })}
                  icon={<SyncOutlined />}
                  label="Round Robin"
                  description="Picks a model at random on each request, distributing load across the list."
                />
              </Col>
            </Row>
          </Flex>

          <Flex
            align="center"
            gap={token.paddingMD}
            style={{
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              background: token.colorFillQuaternary,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Flex vertical gap={0} style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 13 }}>
                Primary model attempts (Máx. 10)
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {ATTEMPTS_HINT[draft.routingStrategy]}
              </Text>
            </Flex>
            <InputNumber
              min={1}
              max={10}
              value={draft.primaryAttempts}
              onChange={(value) => update({ primaryAttempts: value ?? 2 })}
              style={{ width: 72 }}
            />
          </Flex>

          <Card
            size="small"
            title={
              <Space>
                <ThunderboltOutlined />
                Chain order
              </Space>
            }
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {draft.models.length < 2
                  ? "Add at least 2 models"
                  : CHAIN_ORDER_HINT[draft.routingStrategy]}
              </Text>
            }
            styles={{ body: { padding: token.paddingSM, maxHeight: 240, overflowY: "auto" } }}
          >
            <SortableModels
              draft={draft}
              options={options}
              onChange={(models) => update({ models })}
            />
          </Card>

          <AddModelRow
            options={options}
            selectedModels={draft.models}
            onAdd={(entry) => update({ models: [...draft.models, entry] })}
          />
        </Flex>
      )}
    </Modal>
  );
}
