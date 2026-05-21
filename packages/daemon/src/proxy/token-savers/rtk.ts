import type { ContentBlock, MessagesRequest } from "../../core/anthropic/types.js";
import { logger } from "../../observability/log.js";
import { autoDetectFilter, type Filter } from "./rtk-filters.js";

const RAW_CAP = 10 * 1024 * 1024;
const MIN_COMPRESS_SIZE = 500;

export type RtkCompressionStats = {
  bytesBefore: number;
  bytesAfter: number;
  hits: Array<{ shape: string; filter: string; saved: number }>;
};

export function compressMessages(
  req: MessagesRequest,
  enabled: boolean,
): RtkCompressionStats | null {
  if (!enabled) return null;

  const stats: RtkCompressionStats = { bytesBefore: 0, bytesAfter: 0, hits: [] };
  try {
    for (const message of req.messages) {
      if (!Array.isArray(message.content)) continue;
      for (const block of message.content) {
        if (block.type !== "tool_result" || block.is_error === true) continue;
        if (typeof block.content === "string") {
          block.content = compressText(block.content, stats, "claude-string");
        } else if (Array.isArray(block.content)) {
          for (const part of block.content) {
            if (part.type === "text") {
              part.text = compressText(part.text, stats, "claude-array");
            }
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("rtk", `compressMessages failed: ${message}`);
    return null;
  }

  return stats;
}

export function formatRtkLog(stats: RtkCompressionStats | null): string | null {
  if (!stats?.hits.length) return null;
  const saved = stats.bytesBefore - stats.bytesAfter;
  const pct = stats.bytesBefore > 0 ? ((saved / stats.bytesBefore) * 100).toFixed(1) : "0";
  const filters = Array.from(new Set(stats.hits.map((hit) => hit.filter))).join(",");
  return `saved ${saved}B / ${stats.bytesBefore}B (${pct}%) via [${filters}] hits=${stats.hits.length}`;
}

function compressText(text: string, stats: RtkCompressionStats, shape: string): string {
  const bytesIn = text.length;
  stats.bytesBefore += bytesIn;

  if (bytesIn < MIN_COMPRESS_SIZE || bytesIn > RAW_CAP) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  const filter = autoDetectFilter(text);
  if (!filter) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  const out = safeApply(filter, text);
  if (!out || out.length === 0 || out.length >= bytesIn) {
    stats.bytesAfter += bytesIn;
    return text;
  }

  stats.bytesAfter += out.length;
  stats.hits.push({ shape, filter: filter.filterName ?? filter.name, saved: bytesIn - out.length });
  return out;
}

function safeApply(filter: Filter, text: string): string {
  try {
    const out = filter(text);
    return typeof out === "string" ? out : text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      "rtk",
      `filter '${filter.filterName ?? filter.name}' failed; passing through raw output: ${message}`,
    );
    return text;
  }
}

export function cloneMessagesRequest(req: MessagesRequest): MessagesRequest {
  return structuredClone(req) as MessagesRequest;
}

export function extractToolResultText(
  block: Extract<ContentBlock, { type: "tool_result" }>,
): string {
  if (typeof block.content === "string") return block.content;
  return block.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
