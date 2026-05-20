import { useCallback, useRef, useState } from "react";
import type { ModelInfo } from "../domain/types.js";
import { providersService } from "../services/providersService.js";

export function useProviderModels(providerId: string) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  const load = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      setModels(await providersService.listModels(providerId));
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  return { models, loading, load };
}
