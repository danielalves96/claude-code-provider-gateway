import { ThunderboltOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Switch,
  Typography,
  theme,
} from "antd";
import { useEffect } from "react";
import type { RoutingOption } from "../../domain/types.js";
import { normalizeSlug } from "../../domain/utils.js";
import type { DraftChain } from "../../hooks/useChainDraft.js";
import { emptyDraft } from "../../hooks/useChainDraft.js";
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
  const [form] = Form.useForm();

  const canSave =
    !!draft?.name.trim() &&
    !!draft?.slug.trim() &&
    (draft?.models.length ?? 0) > 0 &&
    !existingSlugs.includes(normalizeSlug(draft?.slug ?? ""));

  useEffect(() => {
    form.setFieldsValue(draft ?? emptyDraft());
  }, [draft, form]);

  const update = (patch: Partial<DraftChain>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal
      open={open}
      title={draft?.id.startsWith("chain_") ? "Create Model Chain" : "Edit Model Chain"}
      width={860}
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
          <Form form={form} layout="vertical">
            <Row gutter={token.padding}>
              <Col flex="1">
                <Form.Item label="Name" required>
                  <Input
                    value={draft.name}
                    placeholder="Premium Rescue"
                    onChange={(event) => {
                      const name = event.target.value;
                      update({ name, slug: draft.slug ? draft.slug : normalizeSlug(name) });
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
                Drag to reorder
              </Text>
            }
          >
            <SortableModels
              draft={draft}
              options={options}
              onChange={(models) => update({ models })}
            />
          </Card>

          <AddModelRow
            options={options}
            onAdd={(entry) => update({ models: [...draft.models, entry] })}
          />
        </Flex>
      )}
    </Modal>
  );
}
