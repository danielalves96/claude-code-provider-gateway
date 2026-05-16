// Transport base for providers that speak native Anthropic Messages API
// (OpenRouter, DeepSeek, Ollama, LM Studio, llama.cpp)

import { randomUUID } from "node:crypto";
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

export abstract class AnthropicMessagesTransport extends BaseProvider {
  async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      return { error: { status: 401, message: this.missingApiKeyMessage() } };
    }

    const result = await postProviderStream({
      url: `${this.baseUrl()}/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
        "anthropic-version": "2023-06-01",
        ...this.extraHeaders(),
      },
      body: { ...req, stream: true },
      timeoutMs: this.requestTimeoutMs(),
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    const model = req.model;
    const stream = this.transformStream(result.body, messageId, model, inputTokens);
    return { stream };
  }

  private transformStream(
    body: ReadableStream<Uint8Array>,
    messageId: string,
    model: string,
    inputTokens: number,
  ): ReadableStream<string> {
    let buffer = "";
    let outputTokens = 0;
    let started = false;
    let stopped = false;

    const decoder = new TextDecoder();

    return new ReadableStream<string>({
      async start(controller) {
        const reader = body.getReader();

        const enq = (chunk: string) => controller.enqueue(chunk);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("event: ")) continue;
              if (!line.startsWith("data: ")) continue;

              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              let evt: Record<string, unknown>;
              try {
                evt = JSON.parse(data);
              } catch {
                continue;
              }

              const type = evt.type as string;

              if (!started) {
                enq(ssePing());
                enq(sseMessageStart(messageId, model, inputTokens));
                started = true;
              }

              if (type === "content_block_start") {
                enq(sseContentBlockStart(evt.index as number, evt.content_block));
              } else if (type === "content_block_delta") {
                enq(sseContentBlockDelta(evt.index as number, evt.delta));
              } else if (type === "content_block_stop") {
                enq(sseContentBlockStop(evt.index as number));
              } else if (type === "message_delta") {
                const delta = evt.delta as Record<string, unknown>;
                const usage = evt.usage as Record<string, unknown> | undefined;
                outputTokens = (usage?.output_tokens as number) ?? outputTokens;
                enq(sseMessageDelta((delta?.stop_reason as string) ?? null, outputTokens));
              } else if (type === "message_stop") {
                enq(sseMessageStop());
                stopped = true;
              }
            }
          }

          if (!started) {
            enq(sseMessageStart(messageId, model, inputTokens));
          }
          if (!stopped) {
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
