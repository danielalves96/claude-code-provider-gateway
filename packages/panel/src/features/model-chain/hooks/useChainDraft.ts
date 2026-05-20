import { App } from "antd";
import { useState } from "react";
import type { ModelFallbackConfig } from "../domain/types.js";
import { normalizeSlug } from "../domain/utils.js";

export type DraftChain = Pick<ModelFallbackConfig, "id" | "name" | "slug" | "enabled"> & {
  models: ModelFallbackConfig["models"];
  routingStrategy: NonNullable<ModelFallbackConfig["routingStrategy"]>;
  primaryAttempts: NonNullable<ModelFallbackConfig["primaryAttempts"]>;
};

export const emptyDraft = (): DraftChain => ({
  id: `chain_${Date.now()}`,
  name: "",
  slug: "",
  enabled: true,
  models: [],
  routingStrategy: "waterfall",
  primaryAttempts: 2,
});

export function useChainDraft(
  chains: ModelFallbackConfig[],
  persist: (next: ModelFallbackConfig[]) => Promise<void>,
  providerSlugs: string[] = [],
) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<DraftChain | null>(null);

  const openNew = () => setEditing(emptyDraft());
  const openEdit = (chain: ModelFallbackConfig) =>
    setEditing({
      ...chain,
      routingStrategy: chain.routingStrategy ?? "waterfall",
      primaryAttempts: chain.primaryAttempts ?? 2,
    });
  const cancelEdit = () => setEditing(null);

  const saveDraft = async (draft: DraftChain) => {
    const isNew = draft.id.startsWith("chain_");
    const slug = normalizeSlug(draft.slug || draft.name);
    if (draft.models.length < 2) {
      message.error("Model chains require at least 2 models");
      return;
    }
    const reservedSlugs = new Set([
      ...providerSlugs.map(normalizeSlug),
      ...chains.filter((chain) => chain.id !== draft.id).map((chain) => normalizeSlug(chain.slug)),
    ]);
    if (reservedSlugs.has(slug)) {
      message.error(`Slug "${slug}" already exists`);
      return;
    }
    const clean: ModelFallbackConfig = {
      ...draft,
      name: draft.name.trim(),
      slug,
      models: draft.models,
      enabled: draft.enabled && draft.models.length >= 2,
      routingStrategy: draft.routingStrategy,
      primaryAttempts: draft.primaryAttempts,
    };
    const next = chains.some((chain) => chain.id === clean.id)
      ? chains.map((chain) => (chain.id === clean.id ? clean : chain))
      : [clean, ...chains];
    await persist(next);
    setEditing(null);
    message.success(`Chain ${isNew ? "created" : "updated"} successfully`);
  };

  return { editing, setEditing, openNew, openEdit, cancelEdit, saveDraft };
}
