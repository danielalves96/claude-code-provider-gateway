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

export function transformCopilotChatStream(
  body: ReadableStream<Uint8Array>,
  messageId: string,
  model: string,
  inputTokens: number,
): ReadableStream<string> {
  let buffer = "";
  let outputTokens = 0;
  let blockStarted = false;
  const toolCallBuffers = new Map<number, { id: string; name: string }>();
  const textBlockIndex = 0;
  let finished = false;
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      const enq = (chunk: string) => controller.enqueue(chunk);

      enq(ssePing());
      enq(sseMessageStart(messageId, model, inputTokens));

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

            let chunk: Record<string, unknown>;
            try {
              chunk = JSON.parse(data);
            } catch {
              continue;
            }

            const choices = chunk["choices"] as Array<Record<string, unknown>> | undefined;
            if (!choices?.length) {
              const usage = chunk["usage"] as Record<string, unknown> | undefined;
              if (usage) outputTokens = (usage["completion_tokens"] as number) ?? outputTokens;
              continue;
            }

            const delta = choices[0]?.["delta"] as Record<string, unknown> | undefined;
            const finishReason = choices[0]?.["finish_reason"] as string | null;

            const textDelta = delta?.["content"] as string | undefined;
            if (textDelta) {
              if (!blockStarted) {
                enq(sseContentBlockStart(textBlockIndex, { type: "text", text: "" }));
                blockStarted = true;
              }
              enq(sseContentBlockDelta(textBlockIndex, { type: "text_delta", text: textDelta }));
            }

            const toolCalls = delta?.["tool_calls"] as Array<Record<string, unknown>> | undefined;
            if (toolCalls) {
              for (const tc of toolCalls) {
                const idx = tc["index"] as number;
                if (!toolCallBuffers.has(idx)) {
                  const fn = tc["function"] as Record<string, unknown>;
                  toolCallBuffers.set(idx, {
                    id: (tc["id"] as string) ?? `call_${idx}`,
                    name: (fn?.["name"] as string) ?? "",
                  });
                  enq(
                    sseContentBlockStart(textBlockIndex + 1 + idx, {
                      type: "tool_use",
                      id: tc["id"],
                      name: fn?.["name"],
                      input: {},
                    }),
                  );
                }
                const fn = tc["function"] as Record<string, unknown> | undefined;
                if (fn?.["arguments"]) {
                  enq(
                    sseContentBlockDelta(textBlockIndex + 1 + idx, {
                      type: "input_json_delta",
                      partial_json: fn["arguments"] as string,
                    }),
                  );
                }
              }
            }

            const usage = chunk["usage"] as Record<string, unknown> | undefined;
            if (usage) outputTokens = (usage["completion_tokens"] as number) ?? outputTokens;

            if (finishReason && !finished) {
              finished = true;
              if (blockStarted) enq(sseContentBlockStop(textBlockIndex));
              for (const [idx] of toolCallBuffers) {
                enq(sseContentBlockStop(textBlockIndex + 1 + idx));
              }
              const stopReason =
                finishReason === "tool_calls"
                  ? "tool_use"
                  : finishReason === "length"
                    ? "max_tokens"
                    : "end_turn";
              enq(sseMessageDelta(stopReason, outputTokens));
              enq(sseMessageStop());
            }
          }
        }

        if (!finished) {
          if (blockStarted) enq(sseContentBlockStop(textBlockIndex));
          for (const [idx] of toolCallBuffers) {
            enq(sseContentBlockStop(textBlockIndex + 1 + idx));
          }
          enq(sseMessageDelta("end_turn", outputTokens));
          enq(sseMessageStop());
        }
      } catch (err) {
        enq(sseError("api_error", String(err)));
      } finally {
        controller.close();
      }
    },
  });
}
