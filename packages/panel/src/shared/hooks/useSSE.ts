import { useEffect, useRef } from "react";
import { apiUrl } from "../api/base.js";

interface UseSSEOptions {
  paused?: boolean;
  withCredentials?: boolean;
}

export function useSSE<T>(path: string, onMessage: (data: T) => void, options: UseSSEOptions = {}) {
  const { paused = false, withCredentials = false } = options;
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const es = new EventSource(apiUrl(path), { withCredentials });
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        handler.current(JSON.parse(e.data) as T);
      } catch {
        /* malformed event — drop */
      }
    };
    return () => es.close();
  }, [path, withCredentials]);
}
