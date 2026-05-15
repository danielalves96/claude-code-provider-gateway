// Central log + SSE emitter. Anything that should appear in the panel's
// live-logs feed must go through `log()` here.

const listeners = new Set<(line: string) => void>();
const buffer: string[] = [];
const BUFFER_SIZE = 500;

export function emitLog(line: string) {
  buffer.push(line);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
  for (const fn of listeners) fn(line);
}

export function getLogBuffer(): string[] {
  return [...buffer];
}

export function addLogListener(fn: (line: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, source: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const line = `${ts} [${level.toUpperCase()}] [${source}] ${msg}`;
  const out = level === "error" ? process.stderr : process.stdout;
  out.write(line + "\n");
  emitLog(line);
}

export const logger = {
  info: (source: string, msg: string) => log("info", source, msg),
  warn: (source: string, msg: string) => log("warn", source, msg),
  error: (source: string, msg: string) => log("error", source, msg),
};
