import { randomUUID } from "node:crypto";
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

export function transformOpenAIAccountResponsesStream(
  body: ReadableStream<Uint8Array>,
  messageId: string,
  model: string,
  inputTokens: number,
): ReadableStream<string> {
  let buffer = "";
  let textBlockIndex = -1;
  let nextAvailableIndex = 0;
  let outputTokens = 0;
  let finished = false;
  const toolBlocks = new Map<string, { index: number; id: string; name: string }>();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      const enq = (chunk: string) => controller.enqueue(chunk);

      enq(ssePing());
      enq(sseMessageStart(messageId, model, inputTokens));

      const closeOpenBlocks = () => {
        if (textBlockIndex !== -1) enq(sseContentBlockStop(textBlockIndex));
        for (const tool of toolBlocks.values()) enq(sseContentBlockStop(tool.index));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }
            const type = String(event.type ?? "");

            if (type === "response.output_text.delta") {
              const delta = typeof event.delta === "string" ? event.delta : "";
              if (!delta) continue;
              if (textBlockIndex === -1) {
                textBlockIndex = nextAvailableIndex++;
                enq(sseContentBlockStart(textBlockIndex, { type: "text", text: "" }));
              }
              enq(sseContentBlockDelta(textBlockIndex, { type: "text_delta", text: delta }));
            }

            if (type === "response.output_item.added") {
              const item = event.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const callKey = String(item.id ?? item.call_id ?? randomUUID());
                if (!toolBlocks.has(callKey)) {
                  const blockIndex = nextAvailableIndex++;
                  toolBlocks.set(callKey, {
                    index: blockIndex,
                    id: String(item.call_id ?? callKey),
                    name: String(item.name ?? ""),
                  });
                  enq(
                    sseContentBlockStart(blockIndex, {
                      type: "tool_use",
                      id: String(item.call_id ?? callKey),
                      name: String(item.name ?? ""),
                      input: {},
                    }),
                  );
                }
              }
            }

            if (type === "response.function_call_arguments.delta") {
              const itemId = String(event.item_id ?? event.output_index ?? "");
              const tool = toolBlocks.get(itemId) ?? Array.from(toolBlocks.values()).at(-1);
              const delta = typeof event.delta === "string" ? event.delta : "";
              if (tool && delta) {
                enq(
                  sseContentBlockDelta(tool.index, {
                    type: "input_json_delta",
                    partial_json: delta,
                  }),
                );
              }
            }

            if (type === "response.completed") {
              const response = event.response as Record<string, unknown> | undefined;
              const usage = response?.usage as Record<string, unknown> | undefined;
              outputTokens = numberValue(usage?.output_tokens) ?? outputTokens;
              finished = true;
            }
          }
        }

        closeOpenBlocks();
        enq(sseMessageDelta(toolBlocks.size ? "tool_use" : "end_turn", outputTokens));
        enq(sseMessageStop());
      } catch (err) {
        closeOpenBlocks();
        enq(sseError("api_error", String(err)));
        enq(sseMessageDelta("end_turn", outputTokens));
        enq(sseMessageStop());
        finished = true;
      } finally {
        if (!finished && textBlockIndex === -1 && toolBlocks.size === 0) {
          enq(sseError("api_error", "OpenAI Account stream ended without a completed response"));
        }
        controller.close();
      }
    },
  });
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
