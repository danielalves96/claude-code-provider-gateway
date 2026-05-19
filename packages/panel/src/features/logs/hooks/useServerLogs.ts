import { useCallback, useMemo, useState } from "react";
import { useSSE } from "../../../shared/hooks/useSSE.js";

const MAX_LINES = 5000;

interface LogEvent {
  line: string;
}

export type LogLevel = "all" | "error" | "warn" | "info" | "debug";

export function detectLogLevel(line: string): "error" | "warn" | "info" | "debug" {
  if (/\[ERROR\]/i.test(line)) return "error";
  if (/\[WARN\]/i.test(line)) return "warn";
  if (/\[DEBUG\]/i.test(line)) return "debug";
  return "info";
}

export function useServerLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [wrapLines, setWrapLines] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  useSSE<LogEvent>(
    "/api/logs",
    ({ line }) => setLogs((prev) => [...prev.slice(-(MAX_LINES - 1)), line]),
    { paused },
  );

  const clear = useCallback(() => setLogs([]), []);
  const togglePaused = useCallback(() => setPaused((p) => !p), []);
  const toggleWrap = useCallback(() => setWrapLines((w) => !w), []);
  const toggleLineNumbers = useCallback(() => setShowLineNumbers((n) => !n), []);

  const stats = useMemo(() => {
    let errors = 0;
    let warns = 0;
    let infos = 0;
    let debugs = 0;
    for (const line of logs) {
      const level = detectLogLevel(line);
      if (level === "error") errors++;
      else if (level === "warn") warns++;
      else if (level === "debug") debugs++;
      else infos++;
    }
    return { errors, warns, infos, debugs };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (levelFilter !== "all") {
      result = result.filter((line) => detectLogLevel(line) === levelFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((line) => line.toLowerCase().includes(q));
    }
    return result;
  }, [logs, levelFilter, search]);

  const downloadLogs = useCallback(() => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `server-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return {
    logs,
    filteredLogs,
    stats,
    paused,
    togglePaused,
    clear,
    search,
    setSearch,
    levelFilter,
    setLevelFilter,
    wrapLines,
    toggleWrap,
    showLineNumbers,
    toggleLineNumbers,
    downloadLogs,
  };
}
