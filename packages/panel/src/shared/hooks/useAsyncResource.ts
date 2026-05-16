import { useCallback, useEffect, useState } from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncResource<T> {
  data: T | null;
  status: AsyncStatus;
  error: unknown;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await loader();
      setData(result);
      setStatus("success");
      setError(null);
    } catch (e) {
      setError(e);
      setStatus("error");
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps array is forwarded from caller by design
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback((updater: T | ((prev: T | null) => T)) => {
    setData((prev) =>
      typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater,
    );
  }, []);

  return { data, status, error, reload, setData: update };
}
