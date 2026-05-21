import { BranchesOutlined, SyncOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Collapse,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
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

const ATTEMPTS_HINT: Record<ChainRoutingStrategy, string> = {
  waterfall: "Number of times the primary model is tried before falling through to the next.",
  round_robin:
    "Number of times the initially selected model is tried; later fallback picks get one attempt each.",
};

const CHAIN_ORDER_HINT: Record<ChainRoutingStrategy, string> = {
  waterfall: "Drag to reorder · tried top-to-bottom, falls through on failure",
  round_robin: "Order doesn't matter · fallbacks get 1 attempt each",
};

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;
const DEFAULT_FIRST_TOKEN_TIMEOUT_SECONDS = 30;
const DEFAULT_TOTAL_STREAM_TIMEOUT_SECONDS = 60;

function secondsOrNull(value?: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value / 1000) : null;
}

function millisecondsOrUndefined(value: number | string | null): number | undefined {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0
    ? Math.round(numeric * 1000)
    : undefined;
}

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
        <Flex vertical gap={token.paddingMD}>
          <Form layout="vertical">
            <Row gutter={token.paddingMD}>
              <Col flex="1">
                <Form.Item label="Name" required style={{ marginBottom: 0 }}>
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
                  style={{ marginBottom: 0 }}
                  validateStatus={
                    existingSlugs.includes(normalizeSlug(draft.slug)) ? "error" : undefined
                  }
                  help={
                    existingSlugs.includes(normalizeSlug(draft.slug))
                      ? "Slug already exists"
                      : undefined
                  }
                  tooltip="Letters, numbers, dash, underscore"
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
                <Form.Item label="Enabled" style={{ marginBottom: 0 }}>
                  <Switch checked={draft.enabled} onChange={(enabled) => update({ enabled })} />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Form layout="vertical">
            <Row gutter={token.paddingMD} align="top">
              <Col span={14}>
                <Form.Item label="Routing strategy" style={{ marginBottom: 0 }}>
                  <Segmented
                    block
                    value={draft.routingStrategy}
                    onChange={(val) => update({ routingStrategy: val as ChainRoutingStrategy })}
                    options={[
                      {
                        label: (
                          <Space>
                            <BranchesOutlined /> Waterfall
                          </Space>
                        ),
                        value: "waterfall",
                      },
                      {
                        label: (
                          <Space>
                            <SyncOutlined /> Round Robin
                          </Space>
                        ),
                        value: "round_robin",
                      },
                    ]}
                  />
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                    {draft.routingStrategy === "waterfall"
                      ? "Starts with primary model. Falls through on failure."
                      : "Picks at random on each request, distributing load."}
                  </Text>
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  label="Primary attempts"
                  tooltip={ATTEMPTS_HINT[draft.routingStrategy]}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    min={1}
                    max={10}
                    value={draft.primaryAttempts}
                    onChange={(value) => update({ primaryAttempts: value ?? 2 })}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Collapse
            size="small"
            ghost
            expandIconPosition="end"
            items={[
              {
                key: "advanced",
                label: (
                  <Flex vertical gap={0}>
                    <Text strong>Advanced settings</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Fallback timing for this chain. Leave empty to use the resilient defaults.
                    </Text>
                  </Flex>
                ),
                children: (
                  <Form layout="vertical">
                    <Row gutter={token.paddingSM}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Request timeout"
                          tooltip={`Default ${DEFAULT_REQUEST_TIMEOUT_SECONDS}s. Time allowed for a provider to return response headers before this chain tries the next model.`}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={1}
                            addonAfter="s"
                            placeholder={`${DEFAULT_REQUEST_TIMEOUT_SECONDS}`}
                            value={secondsOrNull(draft.requestTimeoutMs)}
                            onChange={(value) =>
                              update({ requestTimeoutMs: millisecondsOrUndefined(value) })
                            }
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          label="First token timeout"
                          tooltip={`Default ${DEFAULT_FIRST_TOKEN_TIMEOUT_SECONDS}s. Time allowed for useful Anthropic content before any answer is shown; if it expires, the next model is tried.`}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={1}
                            addonAfter="s"
                            placeholder={`${DEFAULT_FIRST_TOKEN_TIMEOUT_SECONDS}`}
                            value={secondsOrNull(draft.streamIdleTimeoutMs)}
                            onChange={(value) =>
                              update({ streamIdleTimeoutMs: millisecondsOrUndefined(value) })
                            }
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          label="Total stream timeout"
                          tooltip={`Default ${DEFAULT_TOTAL_STREAM_TIMEOUT_SECONDS}s. Maximum time for one chain attempt; increase for large contexts or slow local models.`}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={1}
                            addonAfter="s"
                            placeholder={`${DEFAULT_TOTAL_STREAM_TIMEOUT_SECONDS}`}
                            value={secondsOrNull(draft.streamTotalTimeoutMs)}
                            onChange={(value) =>
                              update({ streamTotalTimeoutMs: millisecondsOrUndefined(value) })
                            }
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                ),
              },
            ]}
          />

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
