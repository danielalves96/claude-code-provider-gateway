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
