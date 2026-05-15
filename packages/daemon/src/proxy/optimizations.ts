// Local request optimizations — respond without hitting any provider
// These reduce latency and quota usage for internal Claude Code housekeeping calls.

import { randomUUID } from "node:crypto";
import type { MessagesRequest } from "../core/anthropic/types.js";
import {
  sseContentBlockDelta,
  sseContentBlockStart,
  sseContentBlockStop,
  sseMessageDelta,
  sseMessageStart,
  sseMessageStop,
  ssePing,
} from "../core/sse/writer.js";

type OptimizationResult = { handled: true; stream: ReadableStream<string> } | { handled: false };

function makeTextStream(text: string, model: string): ReadableStream<string> {
  const id = `msg_${randomUUID().replace(/-/g, "")}`;
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(ssePing());
      controller.enqueue(sseMessageStart(id, model, 0));
      controller.enqueue(sseContentBlockStart(0, { type: "text", text: "" }));
      controller.enqueue(sseContentBlockDelta(0, { type: "text_delta", text }));
      controller.enqueue(sseContentBlockStop(0));
      controller.enqueue(sseMessageDelta("end_turn", text.length));
      controller.enqueue(sseMessageStop());
      controller.close();
    },
  });
}

function getTextContent(req: MessagesRequest): string {
  const last = req.messages.at(-1);
  if (!last) return "";
  if (typeof last.content === "string") return last.content;
  return last.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
}

export function tryOptimize(req: MessagesRequest): OptimizationResult {
  const text = getTextContent(req).trim();

  // Network connectivity probe — Claude Code sends this to check network access
  if (text.includes("GET_NETWORK_INFO") || (text.includes("curl") && text.includes("checkip"))) {
    return { handled: true, stream: makeTextStream('{"ip":"127.0.0.1","status":"ok"}', req.model) };
  }

  // Title generation — short meta requests we skip to save quota
  if (req.max_tokens <= 40 && text.toLowerCase().includes("title")) {
    return { handled: true, stream: makeTextStream("Untitled", req.model) };
  }

  // File path suggestions — Claude Code sends very specific probe messages to get
  // path completions. Only intercept when it looks like a bare completions request,
  // not a genuine user prompt that happens to mention "file path".
  if (
    (text.includes("filepath") || text.includes("file path")) &&
    req.max_tokens <= 200 &&
    req.messages.length <= 2
  ) {
    return { handled: true, stream: makeTextStream("[]", req.model) };
  }

  return { handled: false };
}
