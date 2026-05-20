import type { LogLevel } from "../hooks/useServerLogs.js";

export interface ParsedLogLine {
  time: string | null;
  level: string | null;
  module: string | null;
  message: string;
}

export function parseLogLine(line: string): ParsedLogLine {
  const match = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/);
  if (!match) {
    return { time: null, level: null, module: null, message: line };
  }

  return {
    time: match[1],
    level: match[2],
    module: match[3],
    message: match[4],
  };
}

export function getLogLevelColor(level: string): string {
  const normalized = level.toLowerCase();
  if (normalized === "error") return "error";
  if (normalized === "warn") return "warning";
  if (normalized === "info") return "success";
  if (normalized === "debug") return "purple";
  return "default";
}

export function getLogLineBackground(level: LogLevel): string {
  if (level === "error") return "rgba(255, 77, 79, 0.1)";
  if (level === "warn") return "rgba(250, 173, 20, 0.05)";
  return "transparent";
}
