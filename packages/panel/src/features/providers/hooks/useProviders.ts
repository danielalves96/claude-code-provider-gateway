import { App } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { ProviderInfo, TestResult } from "../domain/types.js";
import { mergeModelLists } from "../domain/utils.js";
import { type CustomProviderDraft, providersService } from "../services/providersService.js";

export function useProviders() {
  const { message } = App.useApp();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    providersService
      .list()
      .then((data) => {
        setProviders(data);
        setIsLoading(false);
      })
      .catch(() => {
        setProviders([]);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const test = useCallback(
    async (id: string) => {
      setTesting(id);
      try {
        const result = await providersService.test(id);
        setTestResults((r) => ({ ...r, [id]: result }));
        if (result.ok) {
          message.success(`Connection test passed (${result.latencyMs}ms)`);
        } else {
          message.error(`Test failed: ${result.error ?? "Unknown error"}`);
        }
      } catch {
        setTestResults((r) => ({
          ...r,
          [id]: { ok: false, latencyMs: 0, error: "Request failed" },
        }));
        message.error("Connection test failed");
      } finally {
        setTesting(null);
      }
    },
    [message],
  );

  const toggleEnabled = useCallback(
    async (id: string, currentlyEnabled: boolean) => {
      try {
        await providersService.setEnabled(id, !currentlyEnabled);
        message.success(`Provider ${!currentlyEnabled ? "enabled" : "disabled"}`);
        refresh();
      } catch {
        message.error("Failed to toggle provider status");
      }
    },
    [refresh, message],
  );

  const saveKey = useCallback(
    async (id: string, key: string) => {
      try {
        await providersService.setKey(id, key);
        message.success("API Key saved successfully");
        refresh();
      } catch {
        message.error("Failed to save API Key");
      }
    },
    [refresh, message],
  );

  const removeKey = useCallback(
    async (id: string) => {
      try {
        await providersService.removeKey(id);
        message.success("API Key removed");
        refresh();
      } catch {
        message.error("Failed to remove API Key");
      }
    },
    [refresh, message],
  );

  const saveBaseUrl = useCallback(
    async (id: string, url: string) => {
      try {
        await providersService.setBaseUrl(id, url);
        message.success("Custom Base URL updated");
        refresh();
      } catch {
        message.error("Failed to update Base URL");
      }
    },
    [refresh, message],
  );

  const addModel = useCallback(
    async (p: ProviderInfo, model: string) => {
      const trimmed = model.trim();
      if (!trimmed) return;
      try {
        const next = mergeModelLists([...(p.models ?? []), trimmed]);
        await providersService.setModels(p.id, next);
        message.success(`Model ${trimmed} added`);
        refresh();
      } catch {
        message.error("Failed to add model");
      }
    },
    [refresh, message],
  );

  const removeModel = useCallback(
    async (p: ProviderInfo, model: string) => {
      try {
        const next = (p.models ?? []).filter((m) => m !== model);
        await providersService.setModels(p.id, next);
        message.success(`Model ${model} removed`);
        refresh();
      } catch {
        message.error("Failed to remove model");
      }
    },
    [refresh, message],
  );

  const setDisabledModels = useCallback(
    async (id: string, disabledModels: string[]) => {
      try {
        await providersService.setDisabledModels(id, disabledModels);
        message.success("Active models updated");
        setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, disabledModels } : p)));
      } catch {
        message.error("Failed to update active models");
      }
    },
    [message],
  );

  const setRuntimeLimits = useCallback(
    async (
      id: string,
      limits: { rateLimit: number; rateWindow: number; maxConcurrency: number },
    ) => {
      try {
        await providersService.setRuntimeLimits(id, limits);
        message.success("Runtime limits updated");
        setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...limits } : p)));
      } catch {
        message.error("Failed to update runtime limits");
      }
    },
    [message],
  );

  const testCustom = useCallback(
    async (draft: CustomProviderDraft) => {
      setTesting("custom-provider");
      try {
        const result = await providersService.testCustom(draft);
        if (result.ok) {
          message.success(`Connection test passed (${result.latencyMs}ms)`);
        } else {
          message.error(`Test failed: ${result.error ?? "Unknown error"}`);
        }
        return result;
      } catch {
        const result = { ok: false, latencyMs: 0, error: "Request failed" };
        message.error("Connection test failed");
        return result;
      } finally {
        setTesting(null);
      }
    },
    [message],
  );

  const createCustom = useCallback(
    async (draft: CustomProviderDraft) => {
      try {
        const result = await providersService.createCustom(draft);
        if (result.ok) {
          message.success("Custom provider added");
          refresh();
          return result.id;
        }
        message.error("Failed to add custom provider");
        return null;
      } catch {
        message.error("Failed to add custom provider");
        return null;
      }
    },
    [refresh, message],
  );

  const deleteCustom = useCallback(
    async (id: string) => {
      try {
        await providersService.deleteCustom(id);
        message.success("Custom provider deleted");
        refresh();
      } catch {
        message.error("Failed to delete custom provider");
      }
    },
    [refresh, message],
  );

  return {
    providers,
    isLoading,
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
    setRuntimeLimits,
    testCustom,
    createCustom,
    deleteCustom,
  };
}
