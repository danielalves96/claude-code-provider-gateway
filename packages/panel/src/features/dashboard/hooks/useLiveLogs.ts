import { useCallback, useState } from "react";
import { useSSE } from "../../../shared/hooks/useSSE.js";

const MAX_LINES = 1000;

interface LogEvent {
  line: string;
}

export function useLiveLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);

  useSSE<LogEvent>(
    "/api/logs",
    ({ line }) => setLogs((prev) => [...prev.slice(-(MAX_LINES - 1)), line]),
    { paused },
  );

  const clear = useCallback(() => setLogs([]), []);
  const togglePaused = useCallback(() => setPaused((p) => !p), []);

  return { logs, paused, togglePaused, clear };
}
