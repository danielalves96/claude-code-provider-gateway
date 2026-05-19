import { App } from "antd";
import { useEffect, useRef, useState } from "react";
import type { ModelFallbackConfig, RoutingOption } from "../domain/types.js";
import { modelChainService } from "../services/modelChainService.js";

export function useModelChainPage() {
  const { message } = App.useApp();
  const [chains, setChains] = useState<ModelFallbackConfig[]>([]);
  const [options, setOptions] = useState<RoutingOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const persistInFlight = useRef(false);

  useEffect(() => {
    Promise.all([modelChainService.getConfig(), modelChainService.getOptions()])
      .then(([config, opts]) => {
        setChains(config.modelFallbacks ?? []);
        setOptions(opts);
        setLoadError(null);
      })
      .catch((error) => {
        const text = error instanceof Error ? error.message : "Failed to load model chains";
        setLoadError(text);
        message.error(text);
      })
      .finally(() => setLoaded(true));
  }, [message]);

  const persist = async (next: ModelFallbackConfig[]) => {
    if (persistInFlight.current) {
      throw new Error("A model chain save is already in progress");
    }

    const previous = chains;
    persistInFlight.current = true;
    setChains(next);
    setSaving(true);
    try {
      await modelChainService.save(next);
    } catch (error) {
      setChains(previous);
      throw error;
    } finally {
      persistInFlight.current = false;
      setSaving(false);
    }
  };

  const deleteChain = async (id: string) => {
    try {
      await persist(chains.filter((chain) => chain.id !== id));
      message.success("Chain deleted");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to delete chain");
    }
  };

  const toggleChainEnabled = async (id: string, enabled: boolean) => {
    const next = chains.map((chain) => (chain.id === id ? { ...chain, enabled } : chain));
    try {
      await persist(next);
      message.success(`Chain ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to update chain");
    }
  };

  return { chains, options, loaded, loadError, saving, persist, deleteChain, toggleChainEnabled };
}
