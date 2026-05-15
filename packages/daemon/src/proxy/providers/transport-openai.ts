// Transport base for providers that speak OpenAI Chat Completions format
// (NVIDIA NIM, Kimi)

import { randomUUID } from "node:crypto";
import { anthropicToOpenAI } from "../../core/anthropic/conversion.js";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
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
import { fetchProviderJson, mapProviderModels, postProviderStream } from "./api-client.js";
import type { StreamResult } from "./base.js";
import { BaseProvider } from "./base.js";

export abstract class OpenAIChatTransport extends BaseProvider {
  // Subclasses set the actual model name to send to the provider
  protected abstract resolveModel(requestedModel: string): string;

  async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      return { error: { status: 401, message: this.missingApiKeyMessage() } };
    }

    const providerModel = this.resolveModel(req.model);
    const openaiReq = anthropicToOpenAI(req, providerModel);

    const result = await postProviderStream({
      url: `${this.baseUrl()}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
        ...this.extraHeaders(),
      },
      body: openaiReq,
      timeoutMs: this.requestTimeoutMs(),
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    const stream = this.transformOpenAIStream(result.body, messageId, req.model, inputTokens);
    return { stream };
  }

  private transformOpenAIStream(
    body: ReadableStream<Uint8Array>,
    messageId: string,
    model: string,
    inputTokens: number,
  ): ReadableStream<string> {
    let buffer = "";
    let outputTokens = 0;
    let blockStarted = false;
    const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();
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
              if (data === "[DONE]") continue;

              let chunk: Record<string, unknown>;
              try {
                chunk = JSON.parse(data);
              } catch {
                continue;
              }

              const choices = chunk["choices"] as Array<Record<string, unknown>> | undefined;
              if (!choices?.length) continue;

              const delta = choices[0]?.["delta"] as Record<string, unknown> | undefined;
              const finishReason = choices[0]?.["finish_reason"] as string | null;

              // Text content
              const textDelta = delta?.["content"] as string | undefined;
              if (textDelta) {
                if (!blockStarted) {
                  enq(sseContentBlockStart(textBlockIndex, { type: "text", text: "" }));
                  blockStarted = true;
                }
                enq(sseContentBlockDelta(textBlockIndex, { type: "text_delta", text: textDelta }));
              }

              // Tool calls
              const toolCalls = delta?.["tool_calls"] as Array<Record<string, unknown>> | undefined;
              if (toolCalls) {
                for (const tc of toolCalls) {
                  const idx = tc["index"] as number;
                  if (!toolCallBuffers.has(idx)) {
                    const fn = tc["function"] as Record<string, unknown>;
                    toolCallBuffers.set(idx, {
                      id: tc["id"] as string,
                      name: fn["name"] as string,
                      args: "",
                    });
                    const blockIdx = textBlockIndex + 1 + idx;
                    enq(
                      sseContentBlockStart(blockIdx, {
                        type: "tool_use",
                        id: tc["id"],
                        name: (tc["function"] as Record<string, unknown>)["name"],
                        input: {},
                      }),
                    );
                  }
                  const buf = toolCallBuffers.get(idx)!;
                  const fn = tc["function"] as Record<string, unknown> | undefined;
                  if (fn?.["arguments"]) {
                    buf.args += fn["arguments"] as string;
                    enq(
                      sseContentBlockDelta(textBlockIndex + 1 + idx, {
                        type: "input_json_delta",
                        partial_json: fn["arguments"] as string,
                      }),
                    );
                  }
                }
              }

              // Usage
              const usage = chunk["usage"] as Record<string, unknown> | undefined;
              if (usage) {
                outputTokens = (usage["completion_tokens"] as number) ?? outputTokens;
              }

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

  async listModels(): Promise<ModelInfo[]> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      throw new Error(this.missingApiKeyMessage());
    }

    const url = `${this.baseUrl()}/models`;
    const json = await fetchProviderJson<{
      data?: Array<{ id: string; name?: string; created?: number }>;
    }>({
      url,
      headers: { Authorization: this.authHeader(), ...this.extraHeaders() },
      timeoutMs: this.requestTimeoutMs(),
    });
    return mapProviderModels(json.data ?? [], this.id, this.label);
  }

  protected extraHeaders(): Record<string, string> {
    return {};
  }
}
