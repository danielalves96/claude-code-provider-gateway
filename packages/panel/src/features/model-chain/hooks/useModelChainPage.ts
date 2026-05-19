import { App } from "antd";
import { useEffect, useState } from "react";
import type { ModelFallbackConfig, RoutingOption } from "../domain/types.js";
import { modelChainService } from "../services/modelChainService.js";

export function useModelChainPage() {
  const { message } = App.useApp();
  const [chains, setChains] = useState<ModelFallbackConfig[]>([]);
  const [options, setOptions] = useState<RoutingOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const deleteChain = async (id: string) => {
    await persist(chains.filter((chain) => chain.id !== id));
    message.success("Chain deleted");
  };

  const toggleChainEnabled = async (id: string, enabled: boolean) => {
    const next = chains.map((chain) => (chain.id === id ? { ...chain, enabled } : chain));
    await persist(next);
    message.success(`Chain ${enabled ? "enabled" : "disabled"}`);
  };

  return { chains, options, loaded, saving, persist, deleteChain, toggleChainEnabled };
}
