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
import { stripGatewayProviderPrefix } from "./model-prefix.js";

export abstract class AnthropicMessagesTransport extends BaseProvider {
  protected resolveModel(model: string): string {
    return stripGatewayProviderPrefix(model, this.id);
  }

  // Override to switch to x-api-key auth (Anthropic standard) vs Authorization: Bearer
  protected authHeaders(): Record<string, string> {
    return { Authorization: this.authHeader() };
  }

  protected anthropicBetaHeader(): string | null {
    return null;
  }

  async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      return { error: { status: 401, message: this.missingApiKeyMessage() } };
    }

    const anthropicBeta = this.anthropicBetaHeader();
    const headers = {
      "Content-Type": "application/json",
      ...this.authHeaders(),
      "anthropic-version": "2023-06-01",
      ...(anthropicBeta ? { "anthropic-beta": anthropicBeta } : {}),
      ...this.extraHeaders(),
    };
    const resolvedModel = this.resolveModel(req.model);
    let result = await postProviderStream({
      url: `${this.baseUrl()}/messages`,
      headers,
      body: { ...req, model: resolvedModel, stream: true },
      timeoutMs: this.requestTimeoutMs(),
    });

    // Some models on OpenRouter (and similar providers) don't support tool_choice.
    // Retry without it when we get this specific routing error.
    if (
      "error" in result &&
      result.error.status === 404 &&
      req.tool_choice !== undefined &&
      result.error.message.includes("tool_choice")
    ) {
      const { tool_choice: _dropped, ...reqWithoutToolChoice } = req;
      result = await postProviderStream({
        url: `${this.baseUrl()}/messages`,
        headers,
        body: { ...reqWithoutToolChoice, model: resolvedModel, stream: true },
        timeoutMs: this.requestTimeoutMs(),
      });
    }

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
      headers: { ...this.authHeaders(), ...this.extraHeaders() },
      timeoutMs: this.requestTimeoutMs(),
    });
    const discovered = mapProviderModels(json.data ?? [], this.id, this.label);
    const discoveredIds = new Set(discovered.map((m) => m.id));
    const extra = (this.config.models ?? [])
      .filter((id) => !discoveredIds.has(`anthropic/${this.id}/${id}`))
      .map((id) => ({
        type: "model" as const,
        id: `anthropic/${this.id}/${id}`,
        display_name: `${this.label} · ${id}`,
        created_at: new Date(0).toISOString(),
      }));
    return [...discovered, ...extra];
  }

  protected extraHeaders(): Record<string, string> {
    return {};
  }
}
