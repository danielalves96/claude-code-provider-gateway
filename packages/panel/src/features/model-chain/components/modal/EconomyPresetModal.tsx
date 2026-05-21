import { Flex, Form, Modal, Select, Typography, theme } from "antd";
import { type ReactNode, useMemo, useState } from "react";
import { ProviderLogo } from "../../../providers/components/grid/ProviderLogo.js";
import type { ModelFallbackConfig, RoutingOption } from "../../domain/types.js";
import { normalizeSlug } from "../../domain/utils.js";

const { Text } = Typography;

interface SlotOption {
  label: ReactNode;
  value: string;
  providerId: string;
  modelId: string;
  searchLabel: string;
}

interface EconomyPresetModalProps {
  open: boolean;
  options: RoutingOption[];
  enabledProviderIds: string[];
  chains: ModelFallbackConfig[];
  providerSlugs: string[];
  onApply: (chain: ModelFallbackConfig) => void;
  onCancel: () => void;
}

export function EconomyPresetModal({
  open,
  options,
  enabledProviderIds,
  chains,
  providerSlugs,
  onApply,
  onCancel,
}: EconomyPresetModalProps) {
  const { token } = theme.useToken();
  const enabled = useMemo(() => new Set(enabledProviderIds), [enabledProviderIds]);

  const haikuOptions = useMemo(() => buildHaikuOptions(options, enabled), [options, enabled]);
  const midOptions = useMemo(() => buildMidOptions(options, enabled), [options, enabled]);
  const localOptions = useMemo(() => buildLocalOptions(options, enabled), [options, enabled]);

  const [haiku, setHaiku] = useState<string | undefined>(haikuOptions[0]?.value);
  const [mid, setMid] = useState<string | undefined>(midOptions[0]?.value);
  const [local, setLocal] = useState<string | undefined>(localOptions[0]?.value);

  const selectedEntries = useMemo(() => {
    const all = [
      resolve(haiku, haikuOptions),
      resolve(mid, midOptions),
      resolve(local, localOptions),
    ].filter((e): e is ModelFallbackConfig["models"][number] => !!e);
    return dedupe(all);
  }, [haiku, haikuOptions, mid, midOptions, local, localOptions]);

  const canApply = selectedEntries.length >= 2;

  const handleApply = () => {
    if (!canApply) return;
    const slug = uniqueSlug("economy-local", [
      ...providerSlugs,
      ...chains.filter((c) => c.slug !== "economy-local").map((c) => c.slug),
    ]);
    onApply({
      id: `chain_${slug.replaceAll("-", "_")}`,
      name: "Economy/Local",
      slug,
      enabled: true,
      routingStrategy: "waterfall",
      primaryAttempts: 1,
      models: selectedEntries,
    });
  };

  return (
    <Modal
      title="Economy/Local preset"
      open={open}
      centered
      okText="Apply"
      okButtonProps={{ disabled: !canApply }}
      onOk={handleApply}
      onCancel={onCancel}
      width={440}
      destroyOnClose
    >
      <Flex vertical gap={token.paddingSM} style={{ marginTop: token.paddingSM }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          Pick one model per slot. At least two slots must be filled. The chain tries them in order,
          falling back on failure.
        </Text>

        <Form layout="vertical" style={{ marginTop: token.paddingXS }}>
          <Form.Item
            label="Fast / cheap (haiku, flash, mini, :free…)"
            style={{ marginBottom: token.paddingSM }}
          >
            <Select
              showSearch
              allowClear
              placeholder="Skip this slot"
              options={haikuOptions}
              value={haiku}
              onChange={setHaiku}
              optionFilterProp="searchLabel"
            />
          </Form.Item>

          <Form.Item label="Mid-tier" style={{ marginBottom: token.paddingSM }}>
            <Select
              showSearch
              allowClear
              placeholder="Skip this slot"
              options={midOptions}
              value={mid}
              onChange={setMid}
              optionFilterProp="searchLabel"
            />
          </Form.Item>

          <Form.Item label="Local / last-resort" style={{ marginBottom: 0 }}>
            <Select
              showSearch
              allowClear
              placeholder="Skip this slot"
              options={localOptions}
              value={local}
              onChange={setLocal}
              optionFilterProp="searchLabel"
            />
          </Form.Item>
        </Form>

        {!canApply && (
          <Text type="warning" style={{ fontSize: token.fontSizeSM }}>
            At least two slots are required to create a chain.
          </Text>
        )}
      </Flex>
    </Modal>
  );
}

const FAST_MODEL_TERMS = ["haiku", "flash", "mini", "small", "nano", "lite", "turbo", "instant"];

function buildHaikuOptions(options: RoutingOption[], enabled: Set<string>): SlotOption[] {
  const results: SlotOption[] = [];
  for (const provider of options) {
    if (!enabled.has(provider.id)) continue;
    for (const model of provider.models) {
      const key = `${model.id} ${model.display_name ?? ""}`.toLowerCase();
      if (FAST_MODEL_TERMS.some((t) => key.includes(t)) || key.includes(":free")) {
        const textLabel = model.display_name ?? model.id;
        results.push({
          label: (
            <Flex align="center" gap={8}>
              <ProviderLogo providerId={provider.id} label={provider.label} size={16} />
              <span>{textLabel}</span>
            </Flex>
          ),
          searchLabel: textLabel,
          value: `${provider.id}::${model.id}`,
          providerId: provider.id,
          modelId: model.id,
        });
      }
    }
  }
  return results;
}

const MID_PROVIDER_PRIORITY = ["deepseek", "openrouter", "google", "nvidia_nim", "kilocode"];
const MID_MODEL_TERMS = ["deepseek-chat", "deepseek", "gemini-flash", "flash", "llama"];

function buildMidOptions(options: RoutingOption[], enabled: Set<string>): SlotOption[] {
  const results: SlotOption[] = [];
  const sorted = [...options].sort((a, b) => {
    const ai = MID_PROVIDER_PRIORITY.indexOf(a.id);
    const bi = MID_PROVIDER_PRIORITY.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const provider of sorted) {
    if (!enabled.has(provider.id)) continue;
    for (const model of provider.models) {
      const key = `${model.id} ${model.display_name ?? ""}`.toLowerCase();
      if (MID_MODEL_TERMS.some((t) => key.includes(t))) {
        const textLabel = model.display_name ?? model.id;
        results.push({
          label: (
            <Flex align="center" gap={8}>
              <ProviderLogo providerId={provider.id} label={provider.label} size={16} />
              <span>{textLabel}</span>
            </Flex>
          ),
          searchLabel: textLabel,
          value: `${provider.id}::${model.id}`,
          providerId: provider.id,
          modelId: model.id,
        });
      }
    }
  }

  if (results.length === 0) {
    for (const provider of sorted) {
      if (!enabled.has(provider.id)) continue;
      const first = options.find((o) => o.id === provider.id)?.models[0];
      if (first) {
        const textLabel = first.display_name ?? first.id;
        results.push({
          label: (
            <Flex align="center" gap={8}>
              <ProviderLogo providerId={provider.id} label={provider.label} size={16} />
              <span>{textLabel}</span>
            </Flex>
          ),
          searchLabel: textLabel,
          value: `${provider.id}::${first.id}`,
          providerId: provider.id,
          modelId: first.id,
        });
        break;
      }
    }
  }

  return results;
}

const LOCAL_PROVIDER_IDS = ["ollama", "lmstudio", "llamacpp"];
const LOCAL_MODEL_PRIORITY = ["llama3.1", "llama3", "qwen", "mistral"];

function buildLocalOptions(options: RoutingOption[], enabled: Set<string>): SlotOption[] {
  const results: SlotOption[] = [];
  for (const providerId of LOCAL_PROVIDER_IDS) {
    if (!enabled.has(providerId)) continue;
    const provider = options.find((o) => o.id === providerId);
    if (!provider) continue;
    const sorted = [...provider.models].sort((a, b) => {
      const ai = LOCAL_MODEL_PRIORITY.findIndex((t) => a.id.toLowerCase().includes(t));
      const bi = LOCAL_MODEL_PRIORITY.findIndex((t) => b.id.toLowerCase().includes(t));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    for (const model of sorted) {
      const textLabel = model.display_name ?? model.id;
      results.push({
        label: (
          <Flex align="center" gap={8}>
            <ProviderLogo providerId={provider.id} label={provider.label} size={16} />
            <span>{textLabel}</span>
          </Flex>
        ),
        searchLabel: textLabel,
        value: `${providerId}::${model.id}`,
        providerId,
        modelId: model.id,
      });
    }
  }
  return results;
}

function resolve(
  value: string | undefined,
  slotOptions: SlotOption[],
): ModelFallbackConfig["models"][number] | null {
  if (!value) return null;
  const found = slotOptions.find((o) => o.value === value);
  if (!found) return null;
  return { providerId: found.providerId, model: found.modelId };
}

function dedupe(
  entries: ModelFallbackConfig["models"][number][],
): ModelFallbackConfig["models"][number][] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.providerId}::${e.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSlug(base: string, unavailable: string[]): string {
  const taken = new Set(unavailable.map((s) => normalizeSlug(s)));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
