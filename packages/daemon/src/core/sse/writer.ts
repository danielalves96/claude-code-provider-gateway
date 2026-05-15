// Server-Sent Events serialization in Anthropic format

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseMessageStart(id: string, model: string, inputTokens: number): string {
  return sseEvent("message_start", {
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: 0 },
    },
  });
}

export function sseContentBlockStart(index: number, block: unknown): string {
  return sseEvent("content_block_start", {
    type: "content_block_start",
    index,
    content_block: block,
  });
}

export function sseContentBlockDelta(index: number, delta: unknown): string {
  return sseEvent("content_block_delta", { type: "content_block_delta", index, delta });
}

export function sseContentBlockStop(index: number): string {
  return sseEvent("content_block_stop", { type: "content_block_stop", index });
}

export function sseMessageDelta(stopReason: string | null, outputTokens: number): string {
  return sseEvent("message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: outputTokens },
  });
}

export function sseMessageStop(): string {
  return sseEvent("message_stop", { type: "message_stop" });
}

export function ssePing(): string {
  return sseEvent("ping", { type: "ping" });
}

export function sseError(type: string, message: string): string {
  return sseEvent("error", { type: "error", error: { type, message } });
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export function teeWithCapture(stream: ReadableStream<string>): {
  stream: ReadableStream<string>;
  getCapturedText: () => string;
} {
  let captured = "";

  const transform = new TransformStream<string, string>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      try {
        const lines = chunk.split("\n");
        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent === "content_block_delta") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                captured += parsed.delta.text;
              }
            } catch {}
          } else if (line === "" || line === "\r") {
            currentEvent = "";
          }
        }
      } catch {}
    },
  });

  const wrapped = stream.pipeThrough(transform);
  return {
    stream: wrapped,
    getCapturedText: () => captured,
  };
}
