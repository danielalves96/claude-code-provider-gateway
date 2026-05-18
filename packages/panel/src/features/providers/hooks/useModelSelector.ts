import { useMemo, useState } from "react";
import type { ModelInfo } from "../domain/types.js";
import { stripModelPrefix } from "../domain/utils.js";

interface UseModelSelectorOptions {
  models: ModelInfo[] | null;
  disabledModels: string[];
  onDisabledModelsChange: (disabled: string[]) => void;
}

export function useModelSelector({
  models,
  disabledModels,
  onDisabledModelsChange,
}: UseModelSelectorOptions) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  const disabledSet = useMemo(() => {
    const modelIds = new Set(models?.map((model) => model.id) ?? []);
    return new Set(disabledModels.filter((id) => modelIds.has(id)));
  }, [disabledModels, models]);
  const total = models?.length ?? 0;
  const activeCount = total - disabledSet.size;
  const query = search.trim().toLowerCase();

  const visibleModels = useMemo(() => {
    if (!models) return [];
    if (!query) return models;
    return models.filter((model) =>
      stripModelPrefix(model.display_name).toLowerCase().includes(query),
    );
  }, [models, query]);

  const allDisabled = total > 0 && disabledSet.size === total;
  const someDisabled = disabledSet.size > 0 && disabledSet.size < total;

  function toggleExpanded(): void {
    setExpanded((value) => !value);
  }

  function toggleModel(id: string, checked: boolean): void {
    const next = new Set(disabledSet);
    if (checked) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onDisabledModelsChange([...next]);
  }

  function toggleAll(): void {
    onDisabledModelsChange(disabledSet.size === 0 ? (models ?? []).map((model) => model.id) : []);
  }

  return {
    expanded,
    search,
    query,
    disabledSet,
    visibleModels,
    total,
    activeCount,
    allDisabled,
    someDisabled,
    setSearch,
    toggleExpanded,
    toggleModel,
    toggleAll,
  };
}
