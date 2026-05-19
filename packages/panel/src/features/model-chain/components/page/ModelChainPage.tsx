import {
  ApiOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../../../shared/components/PageHeader.js";
import { useCopyToClipboard } from "../../../../shared/hooks/useCopyToClipboard.js";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ModelFallbackConfig, ModelFallbackEntry, RoutingOption } from "../../domain/types.js";
import { modelChainService } from "../../services/modelChainService.js";

const { Text, Title } = Typography;

type DraftChain = Pick<ModelFallbackConfig, "id" | "name" | "slug" | "enabled"> & {
  models: ModelFallbackEntry[];
};

const emptyDraft = (): DraftChain => ({
  id: `chain_${Date.now()}`,
  name: "",
  slug: "",
  enabled: true,
  models: [],
});

export default function ModelChainPage() {
  const { token } = theme.useToken();
  const [chains, setChains] = useState<ModelFallbackConfig[]>([]);
  const [options, setOptions] = useState<RoutingOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DraftChain | null>(null);

  const [showAlert, setShowAlert] = useState(
    () => localStorage.getItem("ccpg_dismiss_chain_alert") !== "true",
  );

  useEffect(() => {
    Promise.all([modelChainService.getConfig(), modelChainService.getOptions()])
      .then(([config, opts]) => {
        setChains(config.modelFallbacks ?? []);
        setOptions(opts);
      })
      .finally(() => setLoaded(true));
  }, []);

  const persist = async (next: ModelFallbackConfig[]) => {
    setChains(next);
    setSaving(true);
    try {
      await modelChainService.save(next);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (draft: DraftChain) => {
    const isNew = draft.id.startsWith("chain_");
    const clean: ModelFallbackConfig = {
      ...draft,
      name: draft.name.trim(),
      slug: normalizeSlug(draft.slug || draft.name),
      models: draft.models,
      enabled: draft.enabled && draft.models.length > 0,
    };
    const next = chains.some((chain) => chain.id === clean.id)
      ? chains.map((chain) => (chain.id === clean.id ? clean : chain))
      : [clean, ...chains];
    await persist(next);
    setEditing(null);
    message.success(`Chain ${isNew ? "created" : "updated"} successfully`);
  };

  const deleteChain = async (id: string) => {
    await persist(chains.filter((chain) => chain.id !== id));
    message.success("Chain deleted");
  };

  const toggleChainEnabled = async (id: string, enabled: boolean) => {
    const next = chains.map((chain) => (chain.id === id ? { ...chain, enabled } : chain));
    await persist(next);
    message.success(`Chain ${enabled ? "enabled" : "disabled"}`);
  };

  return (
    <Flex vertical gap={token.paddingLG} style={{ paddingBottom: token.paddingLG * 2 }}>
      <Flex justify="space-between" align="flex-start" gap={token.padding}>
        <PageHeader
          title="Model Chain"
          description="Create custom Claude-discoverable models that try providers in your priority order."
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(emptyDraft())}>
          New chain
        </Button>
      </Flex>

      {showAlert && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => {
            localStorage.setItem("ccpg_dismiss_chain_alert", "true");
            setShowAlert(false);
          }}
          message="Model chains appear in Claude as Custom Models"
          description="Use the model picker entry, or launch directly with ccpg --yourSlug. The first model is tried first; failures move to the next entry."
        />
      )}

      {!loaded ? (
        <Card loading />
      ) : chains.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No chains yet"
          style={{
            padding: token.paddingXL,
            border: `1px dashed ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(emptyDraft())}>
            Create your first chain
          </Button>
        </Empty>
      ) : (
        <Row gutter={[token.paddingLG, token.paddingLG]}>
          {chains.map((chain) => (
            <Col xs={24} xl={12} key={chain.id}>
              <ChainCard
                chain={chain}
                options={options}
                saving={saving}
                onEdit={() => setEditing({ ...chain })}
                onDelete={() => deleteChain(chain.id)}
                onToggleEnabled={(enabled) => toggleChainEnabled(chain.id, enabled)}
              />
            </Col>
          ))}
        </Row>
      )}

      <ChainModal
        open={editing !== null}
        draft={editing}
        options={options}
        existingSlugs={chains
          .filter((chain) => chain.id !== editing?.id)
          .map((chain) => chain.slug)}
        onChange={setEditing}
        onCancel={() => setEditing(null)}
        onSave={saveDraft}
      />
    </Flex>
  );
}

function ChainCard({
  chain,
  options,
  saving,
  onEdit,
  onDelete,
  onToggleEnabled,
}: {
  chain: ModelFallbackConfig;
  options: RoutingOption[];
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      hoverable
      styles={{ body: { padding: token.paddingLG } }}
      style={{
        height: "100%",
        borderColor: chain.enabled ? token.colorPrimaryBorder : token.colorBorderSecondary,
      }}
    >
      <Flex vertical gap={token.padding}>
        <Flex justify="space-between" align="flex-start" gap={token.padding}>
          <Flex vertical gap={12} style={{ minWidth: 0, flex: 1 }}>
            <Space wrap>
              <Title level={5} style={{ margin: 0 }}>
                {chain.name}
              </Title>
              <Tag
                color={chain.enabled ? "success" : "error"}
                bordered={false}
                style={{ fontFamily: "monospace", margin: 0 }}
              >
                {chain.enabled ? "Enabled" : "Disabled"}
              </Tag>
            </Space>
            <div style={{ maxWidth: 280 }}>
              <CopySnippet snippet={`ccpg --${chain.slug}`} />
            </div>
          </Flex>
          <Space>
            <Switch
              checked={chain.enabled}
              onChange={onToggleEnabled}
              disabled={saving}
              style={{ marginRight: 8 }}
            />
            <Button icon={<EditOutlined />} onClick={onEdit} disabled={saving} />
            <Button danger icon={<DeleteOutlined />} disabled={saving} onClick={onDelete} />
          </Space>
        </Flex>

        <Flex vertical gap={8} style={{ marginTop: 8 }}>
          {chain.models.map((entry, index) => {
            const provider = options.find((option) => option.id === entry.providerId);
            const model = provider?.models.find((item) => item.id === entry.model);
            return (
              <Flex
                key={`${entry.providerId}/${entry.model}`}
                align="center"
                gap={token.paddingSM}
                style={{
                  padding: token.paddingSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  background: token.colorFillQuaternary,
                }}
              >
                <Tag
                  color={index === 0 ? "blue" : "default"}
                  bordered={false}
                  style={{ fontFamily: "monospace" }}
                >
                  #{index + 1}
                </Tag>
                <ProviderLogo
                  providerId={entry.providerId}
                  label={provider?.label ?? entry.providerId}
                  size={22}
                />
                <Flex vertical style={{ minWidth: 0 }}>
                  <Text strong ellipsis style={{ fontSize: 14 }}>
                    {provider?.label ?? entry.providerId}
                  </Text>
                  <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                    {model?.display_name ?? entry.model}
                  </Text>
                </Flex>
              </Flex>
            );
          })}
        </Flex>
      </Flex>
    </Card>
  );
}

function CopySnippet({ snippet }: { snippet: string }) {
  const { token } = theme.useToken();
  const { copiedKey, copy } = useCopyToClipboard();
  const copied = copiedKey === snippet;

  return (
    <Tooltip title={copied ? "Copied!" : "Copy"}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copy(snippet, snippet);
          message.success("Command copied to clipboard");
        }}
        style={{
          cursor: "pointer",
          background: copied ? `${token.colorSuccess}15` : `${token.colorText}08`,
          border: `1px solid ${copied ? token.colorSuccess : token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: `6px 12px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          transition: "all 0.2s",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            fontWeight: 500,
            color: copied ? token.colorSuccess : token.colorText,
          }}
          ellipsis
        >
          {snippet}
        </Text>
        <CopyOutlined style={{ color: copied ? token.colorSuccess : token.colorTextTertiary }} />
      </button>
    </Tooltip>
  );
}

function ChainModal({
  open,
  draft,
  options,
  existingSlugs,
  onChange,
  onCancel,
  onSave,
}: {
  open: boolean;
  draft: DraftChain | null;
  options: RoutingOption[];
  existingSlugs: string[];
  onChange: (draft: DraftChain | null) => void;
  onCancel: () => void;
  onSave: (draft: DraftChain) => void;
}) {
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const providerOptions = options.map((option) => ({
    value: option.id,
    label: (
      <Flex align="center" gap={8}>
        <ProviderLogo providerId={option.id} label={option.label} size={16} />
        <span>{option.label}</span>
      </Flex>
    ),
    searchLabel: option.label,
  }));

  const canSave =
    !!draft?.name.trim() &&
    !!draft?.slug.trim() &&
    draft.models.length > 0 &&
    !existingSlugs.includes(normalizeSlug(draft.slug));

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
            providerOptions={providerOptions}
            onAdd={(entry) => update({ models: [...draft.models, entry] })}
          />
        </Flex>
      )}
    </Modal>
  );
}

function SortableModels({
  draft,
  options,
  onChange,
}: {
  draft: DraftChain;
  options: RoutingOption[];
  onChange: (models: ModelFallbackEntry[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = draft.models.map((entry, index) => `${entry.providerId}/${entry.model}/${index}`);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0) onChange(arrayMove(draft.models, oldIndex, newIndex));
  };

  if (draft.models.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add at least one model" />;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Flex vertical gap={8}>
          {draft.models.map((entry, index) => (
            <SortableModelRow
              key={ids[index]}
              id={ids[index]}
              index={index}
              entry={entry}
              options={options}
              onRemove={() => {
                onChange(draft.models.filter((_, i) => i !== index));
                message.success("Model removed");
              }}
            />
          ))}
        </Flex>
      </SortableContext>
    </DndContext>
  );
}

function SortableModelRow({
  id,
  index,
  entry,
  options,
  onRemove,
}: {
  id: string;
  index: number;
  entry: ModelFallbackEntry;
  options: RoutingOption[];
  onRemove: () => void;
}) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const provider = options.find((option) => option.id === entry.providerId);
  const model = provider?.models.find((item) => item.id === entry.model);

  return (
    <Flex
      ref={setNodeRef}
      align="center"
      gap={token.padding}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        padding: token.paddingSM,
        borderRadius: token.borderRadius,
        border: `1px solid ${isDragging ? token.colorPrimary : token.colorBorderSecondary}`,
        background: isDragging ? `${token.colorPrimary}0A` : token.colorBgContainer,
        zIndex: isDragging ? 10 : 1,
        position: "relative",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", display: "flex", color: token.colorTextTertiary }}
      >
        <HolderOutlined />
      </div>
      <Tag
        color={index === 0 ? "blue" : "default"}
        bordered={false}
        style={{ fontFamily: "monospace" }}
      >
        #{index + 1}
      </Tag>
      <ProviderLogo
        providerId={entry.providerId}
        label={provider?.label ?? entry.providerId}
        size={22}
      />
      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
        <Text strong ellipsis>
          {provider?.label ?? entry.providerId}
        </Text>
        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
          {model?.display_name ?? entry.model}
        </Text>
      </Flex>
      <Button danger type="text" icon={<DeleteOutlined />} onClick={onRemove} />
    </Flex>
  );
}

function AddModelRow({
  options,
  providerOptions,
  onAdd,
}: {
  options: RoutingOption[];
  providerOptions: Array<{ value: string; label: React.ReactNode; searchLabel: string }>;
  onAdd: (entry: ModelFallbackEntry) => void;
}) {
  const { token } = theme.useToken();
  const [providerId, setProviderId] = useState<string>();
  const [model, setModel] = useState<string>();
  const modelOptions = useMemo(() => {
    const provider = options.find((option) => option.id === providerId);
    return provider?.models.map((item) => ({ value: item.id, label: item.display_name })) ?? [];
  }, [options, providerId]);

  return (
    <Card size="small" style={{ background: token.colorFillQuaternary }}>
      <Flex gap={token.padding} align="center" wrap>
        <ApiOutlined style={{ color: token.colorPrimary }} />
        <Select
          showSearch
          placeholder="Provider"
          value={providerId}
          options={providerOptions}
          filterOption={(input, option) =>
            (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())
          }
          style={{ minWidth: 220, flex: "0 1 260px" }}
          onChange={(value) => {
            setProviderId(value);
            setModel(undefined);
          }}
        />
        <Select
          showSearch
          placeholder="Model"
          value={model}
          options={modelOptions}
          disabled={!providerId}
          style={{ minWidth: 280, flex: "1 1 320px" }}
          onChange={setModel}
          optionFilterProp="label"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!providerId || !model}
          onClick={() => {
            if (!providerId || !model) return;
            onAdd({ providerId: providerId as ModelFallbackEntry["providerId"], model });
            setModel(undefined);
            message.success("Model added to chain");
          }}
        >
          Add
        </Button>
      </Flex>
    </Card>
  );
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .replace(/^--/, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 63);
}
