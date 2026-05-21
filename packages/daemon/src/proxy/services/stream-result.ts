import { SSE_HEADERS, teeWithCapture } from "../../core/sse/writer.js";
import { updateSessionRequestResponse } from "../../runtime/sessions.js";
import { anthropicError } from "../errors.js";
import type { MessageServiceResult } from "./message-service.js";

const RESPONSE_CAPTURE_MAX = 4000;

export function streamResult(stream: ReadableStream<string> | undefined): MessageServiceResult {
  if (!stream) return emptyStreamError();

  return {
    kind: "stream",
    status: 200,
    stream,
    headers: { ...SSE_HEADERS },
  };
}

export function streamResultWithCapture(
  stream: ReadableStream<string> | undefined,
  logEntryId: string | undefined,
): MessageServiceResult {
  if (!stream) return emptyStreamError();
  if (!logEntryId) return streamResult(stream);

  const { stream: captured, getCapturedText } = teeWithCapture(stream);
  const reader = captured.getReader();
  const final = new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          updateCapturedResponse(logEntryId, getCapturedText);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        updateCapturedResponse(logEntryId, getCapturedText);
        controller.error(new Error("Stream read error"));
      }
    },
    cancel() {
      updateCapturedResponse(logEntryId, getCapturedText);
      reader.cancel().catch(() => {});
    },
  });

  return {
    kind: "stream",
    status: 200,
    stream: final,
    headers: { ...SSE_HEADERS },
  };
}

export type UsefulStreamProbeResult =
  | { ok: true; stream: ReadableStream<string> }
  | { ok: false; reason: string; timedOut: boolean };

export async function probeStreamForUsefulAnthropicContent(
  stream: ReadableStream<string>,
  idleTimeoutMs: number,
): Promise<UsefulStreamProbeResult> {
  const reader = stream.getReader();
  const buffered: string[] = [];
  let residual = "";

  try {
    while (true) {
      const read = await readWithTimeout(reader, idleTimeoutMs);
      if (read.timedOut) {
        reader.cancel().catch(() => {});
        return {
          ok: false,
          reason: `Provider stream idle timeout before useful content after ${idleTimeoutMs}ms`,
          timedOut: true,
        };
      }

      const { done, value } = read.result;
      if (done) {
        const drained = drainCompleteAnthropicPayloads(residual, true);
        const finalResult = await probePayloads(drained.payloads, buffered, reader);
        if (finalResult) return finalResult;
        return {
          ok: false,
          reason: "Provider stream ended without useful Anthropic content",
          timedOut: false,
        };
      }

      buffered.push(value);
      const drained = drainCompleteAnthropicPayloads(residual + value);
      residual = drained.residual;
      const probeResult = await probePayloads(drained.payloads, buffered, reader);
      if (probeResult) return probeResult;
    }
  } catch (err) {
    return {
      ok: false,
      reason: `Provider stream failed before useful content: ${formatStreamError(err)}`,
      timedOut: false,
    };
  }
}

async function probePayloads(
  payloads: string[],
  buffered: string[],
  reader: ReadableStreamDefaultReader<string>,
): Promise<UsefulStreamProbeResult | null> {
  for (const payload of payloads) {
    const earlyError = findAnthropicStreamError(payload);
    if (earlyError) {
      await reader.cancel(earlyError).catch(() => {});
      return { ok: false, reason: earlyError, timedOut: false };
    }
    if (hasUsefulAnthropicContent(payload)) {
      return { ok: true, stream: replayBufferedStream(buffered, reader) };
    }
  }
  return null;
}

function updateCapturedResponse(logEntryId: string, getCapturedText: () => string): void {
  updateSessionRequestResponse(logEntryId, getCapturedText().slice(0, RESPONSE_CAPTURE_MAX));
}

function emptyStreamError(): MessageServiceResult {
  return {
    kind: "error",
    status: 500,
    body: anthropicError("api_error", "Provider returned an empty stream"),
  };
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<string>,
  timeoutMs: number,
): Promise<
  { timedOut: false; result: ReadableStreamReadResult<string> } | { timedOut: true; result?: never }
> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      reader.read().then((result) => ({ timedOut: false as const, result })),
      new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function replayBufferedStream(
  buffered: string[],
  reader: ReadableStreamDefaultReader<string>,
): ReadableStream<string> {
  let offset = 0;
  return new ReadableStream<string>({
    async pull(controller) {
      if (offset < buffered.length) {
        controller.enqueue(buffered[offset++]);
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function hasUsefulAnthropicContent(chunk: string): boolean {
  for (const data of parseSseDataLines(chunk)) {
    const evt = parseJsonObject(data);
    if (!evt) continue;
    if (evt.type === "content_block_start" && isUsefulContentBlock(evt.content_block)) return true;
    if (evt.type === "content_block_delta" && isUsefulDelta(evt.delta)) return true;
  }
  return false;
}

function findAnthropicStreamError(chunk: string): string | null {
  for (const data of parseSseDataLines(chunk)) {
    const evt = parseJsonObject(data);
    if (!evt || evt.type !== "error") continue;
    const error = evt.error as Record<string, unknown> | undefined;
    const type = typeof error?.type === "string" ? error.type : "api_error";
    const message =
      typeof error?.message === "string" ? error.message : "Provider emitted a stream error";
    return `${type}: ${message}`;
  }
  return null;
}

function drainCompleteAnthropicPayloads(
  buffer: string,
  flushResidual = false,
): { payloads: string[]; residual: string } {
  const payloads: string[] = [];
  let searchFrom = 0;
  let eventStart = 0;
  let lastEventEnd = 0;

  while (true) {
    const separatorIndex = findSseEventSeparator(buffer, searchFrom);
    if (separatorIndex === -1) break;

    const event = buffer.slice(eventStart, separatorIndex);
    payloads.push(...parseSseEventData(event));

    lastEventEnd = separatorIndex + sseSeparatorLength(buffer, separatorIndex);
    eventStart = lastEventEnd;
    searchFrom = lastEventEnd;
  }

  if (lastEventEnd > 0) {
    const residual = buffer.slice(lastEventEnd);
    if (flushResidual) payloads.push(...parseSseEventData(residual));
    return { payloads, residual: flushResidual ? "" : residual };
  }

  const trimmed = buffer.trim();
  if (flushResidual) {
    payloads.push(...parseSseEventData(buffer));
    if (payloads.length > 0) return { payloads, residual: "" };
  }
  if (!trimmed.startsWith("{")) return { payloads, residual: buffer };
  if (!parseJsonObject(trimmed)) return { payloads, residual: buffer };
  payloads.push(trimmed);
  return { payloads, residual: "" };
}

function findSseEventSeparator(buffer: string, fromIndex: number): number {
  const lf = buffer.indexOf("\n\n", fromIndex);
  const crlf = buffer.indexOf("\r\n\r\n", fromIndex);
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function sseSeparatorLength(buffer: string, separatorIndex: number): number {
  return buffer.startsWith("\r\n\r\n", separatorIndex) ? 4 : 2;
}

function parseSseEventData(event: string): string[] {
  const dataLines: string[] = [];
  for (const rawLine of event.split(/\r?\n/)) {
    if (!rawLine.startsWith("data:")) continue;
    let value = rawLine.slice(5);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  }

  const value = dataLines.join("\n").trim();
  return value && value !== "[DONE]" ? [value] : [];
}

function parseSseDataLines(chunk: string): string[] {
  const trimmed = chunk.trim();
  if (trimmed.startsWith("{") && parseJsonObject(trimmed)) return [trimmed];

  const data: string[] = [];
  for (const line of chunk.split("\n")) {
    if (!line.startsWith("data:")) continue;
    let value = line.slice(5);
    if (value.startsWith(" ")) value = value.slice(1);
    value = value.trim();
    if (value && value !== "[DONE]") data.push(value);
  }
  return data;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isUsefulContentBlock(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  if (block.type === "tool_use") return true;
  if (block.type === "text") return typeof block.text === "string" && block.text.length > 0;
  if (block.type === "thinking") {
    return typeof block.thinking === "string" && block.thinking.length > 0;
  }
  return false;
}

function isUsefulDelta(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const delta = value as Record<string, unknown>;
  return ["text", "partial_json", "thinking"].some(
    (key) => typeof delta[key] === "string" && (delta[key] as string).length > 0,
  );
}

function formatStreamError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
