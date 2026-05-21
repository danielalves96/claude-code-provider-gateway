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
import type { RequestWarning } from "../../runtime/session-types.js";
import { fetchProviderJson, mapProviderModels, postProviderStream } from "./api-client.js";
import type { ProviderRequestOptions, StreamResult } from "./base.js";
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

  async streamResponse(
    req: MessagesRequest,
    inputTokens: number,
    options?: ProviderRequestOptions,
  ): Promise<StreamResult> {
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
    const url = `${this.baseUrl()}/messages`;
    let body = { ...req, model: resolvedModel, stream: true };
    const warnings = anthropicCompatibilityWarnings(req, this.id) ?? [];
    let result = await postProviderStream({
      url,
      headers,
      body,
      timeoutMs: this.requestTimeoutMs(options),
      streamIdleTimeoutMs: this.streamIdleTimeoutMs(options),
      streamTotalTimeoutMs: this.streamTotalTimeoutMs(options),
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
      const retryBody = { ...reqWithoutToolChoice, model: resolvedModel, stream: true };
      warnings.push({
        code: "tool_choice_dropped_on_retry",
        message: "tool_choice dropped on retry after provider rejected it.",
      });
      result = await postProviderStream({
        url,
        headers,
        body: retryBody,
        timeoutMs: this.requestTimeoutMs(options),
        streamIdleTimeoutMs: this.streamIdleTimeoutMs(options),
        streamTotalTimeoutMs: this.streamTotalTimeoutMs(options),
      });
      body = retryBody;
    }

    if ("error" in result) {
      return {
        error: result.error,
        requestPreview: this.requestPreview("anthropic_messages", url, headers, body),
        warnings,
      };
    }

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    const model = req.model;
    const stream = this.transformStream(result.body, messageId, model, inputTokens);
    return {
      stream,
      requestPreview: this.requestPreview("anthropic_messages", url, headers, body),
      warnings,
    };
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

function anthropicCompatibilityWarnings(
  req: MessagesRequest,
  providerId: string,
): RequestWarning[] | undefined {
  const warnings: RequestWarning[] = [];
  if (req.thinking) {
    warnings.push({
      code: "thinking_passthrough_unverified",
      message: `Anthropic thinking configuration was sent to ${providerId}, but this provider may ignore or drop it.`,
      path: "thinking",
    });
  }
  if (hasThinkingBlocks(req)) {
    warnings.push({
      code: "thinking_block_passthrough_unverified",
      message: `Anthropic thinking blocks were sent to ${providerId}, but this provider may ignore or drop them.`,
      path: "messages",
    });
  }
  return warnings.length > 0 ? warnings : undefined;
}

function hasThinkingBlocks(req: MessagesRequest): boolean {
  return req.messages.some(
    (message) =>
      Array.isArray(message.content) && message.content.some((block) => block.type === "thinking"),
  );
}
