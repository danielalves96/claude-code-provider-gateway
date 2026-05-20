import { useCallback, useMemo, useState } from "react";
import { useSSE } from "../../../shared/hooks/useSSE.js";

const MAX_LINES = 5000;

interface LogEvent {
  line: string;
}

export type LogLevel = "all" | "error" | "warn" | "info" | "debug";

interface SaveServerLogsResult {
  path: string;
  bytes: number;
  lines: number;
}

type DownloadLogsResult =
  | { target: "desktop"; path: string; bytes: number; lines: number }
  | { target: "browser"; fileName: string; lines: number };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

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
  const [downloadingLogs, setDownloadingLogs] = useState(false);

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

  const downloadLogs = useCallback(async (): Promise<DownloadLogsResult | null> => {
    if (logs.length === 0) return null;

    const fileName = `server-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    if (typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null) {
      setDownloadingLogs(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<SaveServerLogsResult>("save_server_logs", {
          fileName,
          lines: logs,
        });
        return { target: "desktop", ...result };
      } finally {
        setDownloadingLogs(false);
      }
    }

    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { target: "browser", fileName, lines: logs.length };
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
    downloadingLogs,
    downloadLogs,
  };
}
