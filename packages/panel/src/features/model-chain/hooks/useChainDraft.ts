import { App } from "antd";
import { useState } from "react";
import type { ModelFallbackConfig } from "../domain/types.js";
import { normalizeSlug } from "../domain/utils.js";

export type DraftChain = Pick<ModelFallbackConfig, "id" | "name" | "slug" | "enabled"> & {
  models: ModelFallbackConfig["models"];
};

export const emptyDraft = (): DraftChain => ({
  id: `chain_${Date.now()}`,
  name: "",
  slug: "",
  enabled: true,
  models: [],
});

export function useChainDraft(
  chains: ModelFallbackConfig[],
  persist: (next: ModelFallbackConfig[]) => Promise<void>,
) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<DraftChain | null>(null);

  const openNew = () => setEditing(emptyDraft());
  const openEdit = (chain: ModelFallbackConfig) => setEditing({ ...chain });
  const cancelEdit = () => setEditing(null);

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

  return { editing, setEditing, openNew, openEdit, cancelEdit, saveDraft };
}
