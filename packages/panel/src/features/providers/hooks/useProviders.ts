import { useCallback, useEffect, useState } from "react";
import { providersService } from "../providersService.js";
import type { ProviderInfo, TestResult } from "../types.js";
import { mergeModelLists } from "../utils.js";

export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const refresh = useCallback(() => {
    providersService
      .list()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const test = useCallback(async (id: string) => {
    setTesting(id);
    try {
      const result = await providersService.test(id);
      setTestResults((r) => ({ ...r, [id]: result }));
    } catch {
      setTestResults((r) => ({
        ...r,
        [id]: { ok: false, latencyMs: 0, error: "Request failed" },
      }));
    } finally {
      setTesting(null);
    }
  }, []);

  const toggleEnabled = useCallback(
    async (id: string, currentlyEnabled: boolean) => {
      await providersService.setEnabled(id, !currentlyEnabled);
      refresh();
    },
    [refresh],
  );

  const saveKey = useCallback(
    async (id: string, key: string) => {
      await providersService.setKey(id, key);
      refresh();
    },
    [refresh],
  );

  const removeKey = useCallback(
    async (id: string) => {
      await providersService.removeKey(id);
      refresh();
    },
    [refresh],
  );

  const saveBaseUrl = useCallback(
    async (id: string, url: string) => {
      await providersService.setBaseUrl(id, url);
      refresh();
    },
    [refresh],
  );

  const addModel = useCallback(
    async (p: ProviderInfo, model: string) => {
      const trimmed = model.trim();
      if (!trimmed) return;
      const next = mergeModelLists([...(p.models ?? []), trimmed]);
      await providersService.setModels(p.id, next);
      refresh();
    },
    [refresh],
  );

  const removeModel = useCallback(
    async (p: ProviderInfo, model: string) => {
      const next = (p.models ?? []).filter((m) => m !== model);
      await providersService.setModels(p.id, next);
      refresh();
    },
    [refresh],
  );

  const setDisabledModels = useCallback(async (id: string, disabledModels: string[]) => {
    await providersService.setDisabledModels(id, disabledModels);
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, disabledModels } : p)));
  }, []);

  return {
    providers,
    testing,
    testResults,
    refresh,
    test,
    toggleEnabled,
    saveKey,
    removeKey,
    saveBaseUrl,
    addModel,
    removeModel,
    setDisabledModels,
  };
}
