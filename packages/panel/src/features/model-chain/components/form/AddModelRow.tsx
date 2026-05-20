import { ApiOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Flex, Select, theme } from "antd";
import { useMemo, useState } from "react";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ModelFallbackEntry, RoutingOption } from "../../domain/types.js";

interface AddModelRowProps {
  options: RoutingOption[];
  selectedModels: ModelFallbackEntry[];
  onAdd: (entry: ModelFallbackEntry) => void;
}

export function AddModelRow({ options, selectedModels, onAdd }: AddModelRowProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [providerId, setProviderId] = useState<string>();
  const [model, setModel] = useState<string>();

  const providerOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: (
          <Flex align="center" gap={8}>
            <ProviderLogo providerId={option.id} label={option.label} size={16} />
            <span>{option.label}</span>
          </Flex>
        ),
        searchLabel: option.label,
      })),
    [options],
  );

  const modelOptions = useMemo(() => {
    const provider = options.find((option) => option.id === providerId);
    if (!provider) return [];

    const usedModels = new Set(
      selectedModels.filter((sm) => sm.providerId === providerId).map((sm) => sm.model),
    );

    return provider.models
      .filter((item) => !usedModels.has(item.id))
      .map((item) => ({ value: item.id, label: item.display_name }));
  }, [options, providerId, selectedModels]);

  return (
    <Card size="small" style={{ background: token.colorFillQuaternary }}>
      <Flex gap={token.paddingSM} align="center" wrap={false}>
        <ApiOutlined style={{ color: token.colorPrimary, flexShrink: 0 }} />
        <Select
          showSearch
          placeholder="Provider"
          value={providerId}
          options={providerOptions}
          filterOption={(input, option) =>
            (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase())
          }
          style={{ minWidth: 140, flex: "1 1 auto" }}
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
          style={{ minWidth: 180, flex: "2 1 auto" }}
          onChange={setModel}
          optionFilterProp="label"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!providerId || !model}
          style={{ flexShrink: 0 }}
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
