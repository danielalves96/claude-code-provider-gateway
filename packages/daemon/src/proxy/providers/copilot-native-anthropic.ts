import type { MessagesRequest } from "../../core/anthropic/types.js";
import { postProviderStream } from "./api-client.js";
import type { StreamResult } from "./base.js";

interface NativeAnthropicStreamOptions {
  req: MessagesRequest;
  providerModel: string;
  endpoint: string;
  headers: Record<string, string>;
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
  streamTotalTimeoutMs?: number;
  abortSignal?: AbortSignal;
}

export async function streamCopilotNativeAnthropic({
  req,
  providerModel,
  endpoint,
  headers,
  timeoutMs,
  streamIdleTimeoutMs,
  streamTotalTimeoutMs,
  abortSignal,
}: NativeAnthropicStreamOptions): Promise<StreamResult> {
  const result = await postProviderStream({
    url: `${endpoint}/v1/messages`,
    headers: {
      ...headers,
      "anthropic-version": "2023-06-01",
    },
    body: buildCopilotAnthropicBody(req, providerModel),
    timeoutMs,
    streamIdleTimeoutMs,
    streamTotalTimeoutMs,
    abortSignal,
  });

  if ("error" in result) return { error: result.error };

  return { stream: decodeNativeAnthropicStream(result.body) };
}

export function buildCopilotAnthropicBody(
  req: MessagesRequest,
  providerModel: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: providerModel,
    messages: req.messages,
    max_tokens: req.max_tokens,
    stream: true,
  };

  if (req.system !== undefined) body.system = req.system;
  if (req.tools !== undefined) body.tools = req.tools;
  if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.top_k !== undefined) body.top_k = req.top_k;
  if (req.thinking !== undefined) body.thinking = req.thinking;
  if (req.metadata !== undefined) body.metadata = req.metadata;
  if (req.stop_sequences !== undefined) body.stop_sequences = req.stop_sequences;

  return body;
}

function decodeNativeAnthropicStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        controller.enqueue(
          `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "api_error", message: String(err) } })}\n\n`,
        );
      } finally {
        controller.close();
      }
    },
  });
}
