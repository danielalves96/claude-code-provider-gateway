import {
  sseContentBlockDelta,
  sseContentBlockStart,
  sseContentBlockStop,
  sseError,
  sseMessageDelta,
  sseMessageStart,
  sseMessageStop,
  ssePing,
} from "../../core/sse/writer.js";

type CommandCodeEvent = Record<string, unknown> & { type?: string };

interface TransformState {
  textIndex: number | null;
  reasoningIndex: number | null;
  nextBlockIndex: number;
  toolById: Map<
    string,
    { index: number; id: string; name: string; stopped: boolean; streamed: boolean }
  >;
  deferredStops: number[];
  finishReason: string | null;
  outputTokens: number;
  finished: boolean;
  emittedContent: boolean;
}

export function commandCodeStreamToAnthropic(
  body: ReadableStream<Uint8Array>,
  options: { messageId: string; model: string; inputTokens: number },
): ReadableStream<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  const state = createTransformState();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      const enq = (chunk: string) => controller.enqueue(chunk);

      enq(ssePing());
      enq(sseMessageStart(options.messageId, options.model, options.inputTokens));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            handleCommandCodeLine(line, state, enq);
          }
        }

        const trailing = buffer.trim();
        if (trailing) handleCommandCodeLine(trailing, state, enq);
        finishAnthropicMessage(state, enq);
      } catch (err) {
        enq(sseError("api_error", err instanceof Error ? err.message : String(err)));
        state.finishReason = "end_turn";
        finishAnthropicMessage(state, enq);
      } finally {
        controller.close();
      }
    },
  });
}

function createTransformState(): TransformState {
  return {
    textIndex: null,
    reasoningIndex: null,
    nextBlockIndex: 0,
    toolById: new Map(),
    deferredStops: [],
    finishReason: null,
    outputTokens: 0,
    finished: false,
    emittedContent: false,
  };
}

function handleCommandCodeLine(
  line: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  const data = normalizeEventLine(line);
  if (!data) return;

  let event: CommandCodeEvent;
  try {
    event = JSON.parse(data) as CommandCodeEvent;
  } catch {
    return;
  }

  handleCommandCodeEvent(event, state, enq);
}

function normalizeEventLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === "[DONE]") return null;
  return data;
}

function handleCommandCodeEvent(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  switch (event.type) {
    case "text-delta":
      emitTextDelta(stringValue(event.text ?? event.delta), state, enq);
      break;
    case "reasoning-delta":
      emitReasoningDelta(stringValue(event.text ?? event.delta), state, enq);
      break;
    case "tool-input-start":
      startToolBlock(toolId(event), stringValue(event.toolName), state, enq);
      break;
    case "tool-input-delta":
      emitToolDelta(toolId(event), stringValue(event.delta ?? event.inputTextDelta), state, enq);
      break;
    case "tool-input-end":
      stopToolBlock(toolId(event), state);
      break;
    case "tool-call":
      emitToolCall(event, state, enq);
      break;
    case "finish-step":
      state.finishReason = mapFinishReason(stringValue(event.finishReason));
      updateUsage(event.usage, state);
      break;
    case "finish":
      state.finishReason = state.finishReason ?? mapFinishReason(stringValue(event.finishReason));
      updateUsage(event.totalUsage ?? event.usage, state);
      finishAnthropicMessage(state, enq);
      break;
    case "error":
      enq(sseError("api_error", errorMessage(event)));
      state.finishReason = "end_turn";
      finishAnthropicMessage(state, enq);
      break;
    default:
      if (isCommandCodeErrorObject(event)) {
        emitTextDelta(`CommandCode error: ${errorMessage(event)}`, state, enq);
        state.finishReason = "end_turn";
        finishAnthropicMessage(state, enq);
        break;
      }
      emitKnownTextPayload(event, state, enq);
      updateUsage(event.usage, state);
      break;
  }
}

function isCommandCodeErrorObject(event: CommandCodeEvent): boolean {
  return event.success === false || typeof event.error === "object";
}

function emitKnownTextPayload(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (typeof event.message === "string") emitTextDelta(event.message, state, enq);
  if (typeof event.content === "string") emitTextDelta(event.content, state, enq);
  if (!Array.isArray(event.content)) return;

  for (const block of event.content) {
    if (!block || typeof block !== "object") continue;
    const contentBlock = block as CommandCodeEvent;
    if (contentBlock.type === "text") emitTextDelta(stringValue(contentBlock.text), state, enq);
    if (contentBlock.type === "reasoning") {
      emitReasoningDelta(stringValue(contentBlock.text), state, enq);
    }
    if (contentBlock.type === "tool-call") emitToolCall(contentBlock, state, enq);
  }
}

function emitTextDelta(text: string, state: TransformState, enq: (chunk: string) => void): void {
  if (!text) return;
  if (state.textIndex == null) {
    state.textIndex = state.nextBlockIndex++;
    enq(sseContentBlockStart(state.textIndex, { type: "text", text: "" }));
  }
  state.emittedContent = true;
  enq(sseContentBlockDelta(state.textIndex, { type: "text_delta", text }));
}

function emitReasoningDelta(
  text: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!text) return;
  if (state.reasoningIndex == null) {
    state.reasoningIndex = state.nextBlockIndex++;
    enq(sseContentBlockStart(state.reasoningIndex, { type: "thinking", thinking: "" }));
  }
  state.emittedContent = true;
  enq(sseContentBlockDelta(state.reasoningIndex, { type: "thinking_delta", thinking: text }));
}

function startToolBlock(
  id: string,
  name: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!id) return;
  const existing = state.toolById.get(id);
  if (existing) return;

  if (state.textIndex != null) {
    state.deferredStops.push(state.textIndex);
    state.textIndex = null;
  }
  if (state.reasoningIndex != null) {
    state.deferredStops.push(state.reasoningIndex);
    state.reasoningIndex = null;
  }

  const tool = {
    index: state.nextBlockIndex++,
    id,
    name,
    stopped: false,
    streamed: false,
  };
  state.toolById.set(id, tool);
  state.emittedContent = true;
  enq(sseContentBlockStart(tool.index, { type: "tool_use", id, name, input: {} }));
}

function emitToolDelta(
  id: string,
  partialJson: string,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  if (!id || !partialJson) return;
  const tool = state.toolById.get(id);
  if (!tool || tool.stopped) return;
  tool.streamed = true;
  enq(sseContentBlockDelta(tool.index, { type: "input_json_delta", partial_json: partialJson }));
}

function stopToolBlock(id: string, state: TransformState): void {
  const tool = state.toolById.get(id);
  if (!tool || tool.stopped) return;
  tool.stopped = true;
  state.deferredStops.push(tool.index);
}

function emitToolCall(
  event: CommandCodeEvent,
  state: TransformState,
  enq: (chunk: string) => void,
): void {
  const id = toolId(event);
  if (!id) return;
  const existing = state.toolById.get(id);
  if (existing?.streamed) {
    stopToolBlock(id, state);
    return;
  }

  startToolBlock(id, stringValue(event.toolName), state, enq);
  const input = typeof event.input === "string" ? event.input : JSON.stringify(event.input ?? {});
  emitToolDelta(id, input, state, enq);
  stopToolBlock(id, state);
}

function finishAnthropicMessage(state: TransformState, enq: (chunk: string) => void): void {
  if (state.finished) return;
  state.finished = true;

  const stopIndexes: number[] = [...state.deferredStops];
  if (state.reasoningIndex != null) stopIndexes.push(state.reasoningIndex);
  if (state.textIndex != null) stopIndexes.push(state.textIndex);
  for (const tool of state.toolById.values()) {
    if (!tool.stopped) {
      tool.stopped = true;
      stopIndexes.push(tool.index);
    }
  }
  for (const index of stopIndexes.sort((a, b) => a - b)) {
    enq(sseContentBlockStop(index));
  }

  if (!state.emittedContent) {
    const index = state.nextBlockIndex++;
    enq(sseContentBlockStart(index, { type: "text", text: "" }));
    enq(
      sseContentBlockDelta(index, {
        type: "text_delta",
        text: "CommandCode returned an empty response for this request.",
      }),
    );
    enq(sseContentBlockStop(index));
  }

  enq(sseMessageDelta(state.finishReason ?? "end_turn", state.outputTokens));
  enq(sseMessageStop());
}

function toolId(event: CommandCodeEvent): string {
  return stringValue(event.id ?? event.toolCallId);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapFinishReason(reason: string): string {
  switch (reason) {
    case "tool-calls":
    case "tool_use":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "stop":
    case "":
      return "end_turn";
    default:
      return reason;
  }
}

function updateUsage(usage: unknown, state: TransformState): void {
  if (!usage || typeof usage !== "object") return;
  const value = usage as Record<string, unknown>;
  const outputTokens = value.outputTokens ?? value.completion_tokens ?? value.output_tokens;
  if (typeof outputTokens === "number" && Number.isFinite(outputTokens)) {
    state.outputTokens = outputTokens;
  }
}

function errorMessage(event: CommandCodeEvent): string {
  const value = event.error ?? event.message ?? "unknown error";
  if (value && typeof value === "object" && "message" in value) {
    return stringValue((value as { message?: unknown }).message) || JSON.stringify(value);
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
