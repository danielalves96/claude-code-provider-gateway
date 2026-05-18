import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderConfig } from "../../config/schema.js";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import { AnthropicMessagesTransport } from "./transport-anthropic.js";

const config: ProviderConfig = {
  enabled: true,
  apiKey: "test-key",
  baseUrl: "https://provider.example/v1",
  rateLimit: 0,
  rateWindow: 0,
  maxConcurrency: 0,
};

const request: MessagesRequest = {
  model: "anthropic/test-provider/claude-test",
  messages: [{ role: "user", content: "hello" }],
  max_tokens: 1,
};

class TestAnthropicTransport extends AnthropicMessagesTransport {
  get id() {
    return "test-provider";
  }

  get label() {
    return "Test Provider";
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }
}

class BetaAnthropicTransport extends TestAnthropicTransport {
  protected override anthropicBetaHeader(): string | null {
    return "test-beta";
  }
}

test("AnthropicMessagesTransport does not send anthropic-beta by default", async () => {
  const headers = await captureStreamHeaders(new TestAnthropicTransport(config));

  assert.equal(headers.get("anthropic-version"), "2023-06-01");
  assert.equal(headers.has("anthropic-beta"), false);
});

test("AnthropicMessagesTransport sends anthropic-beta only when opted in", async () => {
  const headers = await captureStreamHeaders(new BetaAnthropicTransport(config));

  assert.equal(headers.get("anthropic-beta"), "test-beta");
});

async function captureStreamHeaders(provider: AnthropicMessagesTransport): Promise<Headers> {
  let captured: Headers | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    captured = new Headers(init?.headers);
    return new Response(
      new ReadableStream<Uint8Array>({ start: (controller) => controller.close() }),
    );
  };

  try {
    const result = await provider.streamResponse(request, 0);
    assert.equal(result.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(captured);
  return captured;
}
