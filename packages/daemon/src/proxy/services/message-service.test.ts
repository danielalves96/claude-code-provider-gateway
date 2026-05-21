import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";
import { buildDefaultConfig } from "../../config/index.js";
import type { Config } from "../../config/schema.js";
import {
  sseContentBlockDelta,
  sseContentBlockStart,
  sseMessageDelta,
  sseMessageStart,
  sseMessageStop,
} from "../../core/sse/writer.js";
import { endAllSessions, listCurrentSessions, startSession } from "../../runtime/sessions.js";
import type { ProviderRequestOptions, StreamResult } from "../providers/base.js";
import { ProxyRuntime } from "../runtime.js";
import { MessageService, shouldUseNativeClaudePassthrough } from "./message-service.js";
import { resetProviderLimitsForTest } from "./provider-limiter.js";

afterEach(() => {
  endAllSessions();
  resetProviderLimitsForTest();
});

test("MessageService returns Anthropic not_found_error when routed provider is disabled", async () => {
  const config = buildDefaultConfig();
  for (const provider of Object.values(config.providers)) provider.enabled = false;
  const service = new MessageService(new ProxyRuntime(config));

  // Use a non-native model name so the request goes through the routing layer
  // (native claude-* names bypass routing entirely and stream from api.anthropic.com).
  const result = await service.createMessage({
    model: "nvidia_nim/some-model",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(result.kind, "error");
  if (result.kind === "error") {
    assert.equal(result.status, 404);
    assert.equal(result.body.type, "error");
    assert.equal(result.body.error.type, "not_found_error");
  }
});

test("native Claude passthrough is blocked when a ccpg provider is active", () => {
  const config = buildDefaultConfig();
  config.activeProvider = "copilot";
  config.modelMode = "all";
  config.providers.copilot.enabled = true;

  assert.equal(shouldUseNativeClaudePassthrough("claude-haiku-4-5-20251001", config, null), false);
});

test("native Claude passthrough is blocked after a provider-prefixed model is selected", () => {
  const config = buildDefaultConfig();

  assert.equal(
    shouldUseNativeClaudePassthrough("claude-haiku-4-5-20251001", config, {
      providerId: "copilot",
      providerModel: "gpt-4o",
    }),
    false,
  );
});

test("model chain falls back after provider HTTP 500 or 429", async () => {
  for (const status of [500, 429]) {
    const config = chainConfig();
    const primary = new FakeProvider([{ error: { status, message: "try next" } }]);
    const secondary = new FakeProvider([{ stream: usefulTextStream("fallback ok") }]);
    const service = fakeService(config, { nvidia_nim: primary, deepseek: secondary });

    const result = await service.createMessage(chainRequest());

    assert.equal(result.kind, "stream");
    assert.equal(primary.calls, 1);
    assert.equal(secondary.calls, 1);
    if (result.kind === "stream") {
      assert.match(await readAll(result.stream), /fallback ok/);
    }
  }
});

test("model chain falls back when HTTP 200 stream has no useful content", async () => {
  const cases: Array<{ name: string; stream: ReadableStream<string> }> = [
    { name: "empty", stream: streamFromChunks([]) },
    { name: "malformed json", stream: streamFromChunks(["data: {not-json}\n\n"]) },
    { name: "early stream error", stream: erroringStream(new Error("parser exploded")) },
  ];

  for (const item of cases) {
    const config = chainConfig();
    const primary = new FakeProvider([{ stream: item.stream }]);
    const secondary = new FakeProvider([{ stream: usefulTextStream(`${item.name} fallback`) }]);
    const service = fakeService(config, { nvidia_nim: primary, deepseek: secondary });

    const result = await service.createMessage(chainRequest());

    assert.equal(result.kind, "stream", item.name);
    assert.equal(primary.calls, 1, item.name);
    assert.equal(secondary.calls, 1, item.name);
    if (result.kind === "stream") {
      assert.match(await readAll(result.stream), new RegExp(`${item.name} fallback`), item.name);
    }
  }
});

test("model chain accepts useful content split across stream chunks", async () => {
  const config = chainConfig();
  const usefulEvent = sseContentBlockDelta(0, { type: "text_delta", text: "split ok" });
  const primary = new FakeProvider([
    {
      stream: streamFromChunks([
        sseMessageStart("msg_test", "test-model", 1),
        sseContentBlockStart(0, { type: "text", text: "" }),
        usefulEvent.slice(0, 12),
        usefulEvent.slice(12),
        sseMessageDelta("end_turn", 1),
        sseMessageStop(),
      ]),
    },
  ]);
  const secondary = new FakeProvider([{ stream: usefulTextStream("should not fallback") }]);
  const service = fakeService(config, { nvidia_nim: primary, deepseek: secondary });

  const result = await service.createMessage(chainRequest());

  assert.equal(result.kind, "stream");
  assert.equal(primary.calls, 1);
  assert.equal(secondary.calls, 0);
  if (result.kind === "stream") {
    assert.match(await readAll(result.stream), /split ok/);
  }
});

test("model chain falls back when a provider transport throws", async () => {
  const config = chainConfig();
  const primary = new FakeProvider([new Error("socket hang up")]);
  const secondary = new FakeProvider([{ stream: usefulTextStream("transport fallback") }]);
  const service = fakeService(config, { nvidia_nim: primary, deepseek: secondary });

  const result = await service.createMessage(chainRequest());

  assert.equal(result.kind, "stream");
  assert.equal(primary.calls, 1);
  assert.equal(secondary.calls, 1);
  if (result.kind === "stream") {
    assert.match(await readAll(result.stream), /transport fallback/);
  }
});

test("model chain idle timeout falls back before useful content", async () => {
  const config = chainConfig();
  config.modelFallbacks[0].streamIdleTimeoutMs = 10;
  const primary = new FakeProvider([{ stream: stalledStream() }]);
  const secondary = new FakeProvider([{ stream: usefulTextStream("after idle") }]);
  const service = fakeService(config, { nvidia_nim: primary, deepseek: secondary });

  const result = await service.createMessage(chainRequest());

  assert.equal(result.kind, "stream");
  assert.equal(primary.calls, 1);
  assert.equal(secondary.calls, 1);
  if (result.kind === "stream") {
    assert.match(await readAll(result.stream), /after idle/);
  }
});

test("model chain passes chain timeout policy to provider attempt", async () => {
  const config = chainConfig();
  config.modelFallbacks[0].requestTimeoutMs = 1_234;
  config.modelFallbacks[0].streamIdleTimeoutMs = 2_345;
  config.modelFallbacks[0].streamTotalTimeoutMs = 3_456;
  const primary = new FakeProvider([{ stream: usefulTextStream("timeout policy") }]);
  const service = fakeService(config, { nvidia_nim: primary });

  const result = await service.createMessage(chainRequest());

  assert.equal(result.kind, "stream");
  assert.equal(primary.lastOptions?.requestTimeoutMs, 1_234);
  assert.equal(primary.lastOptions?.streamIdleTimeoutMs, undefined);
  assert.equal(primary.lastOptions?.streamTotalTimeoutMs, 3_456);
  if (result.kind === "stream") await readAll(result.stream);
});

test("MessageService passes client abort signal to provider attempts", async () => {
  const config = chainConfig();
  const provider = new FakeProvider([{ stream: usefulTextStream("abort signal") }]);
  const service = fakeService(config, { nvidia_nim: provider });
  const abort = new AbortController();

  const result = await service.createMessage(
    {
      model: "nvidia_nim/model-a",
      max_tokens: 16,
      messages: [{ role: "user", content: "hello" }],
    },
    null,
    abort.signal,
  );

  assert.equal(result.kind, "stream");
  assert.equal(provider.lastOptions?.abortSignal, abort.signal);
  if (result.kind === "stream") await readAll(result.stream);
});

test("MessageService stops before provider call when request is already aborted", async () => {
  const config = chainConfig();
  const provider = new FakeProvider([{ stream: usefulTextStream("should not start") }]);
  const service = fakeService(config, { nvidia_nim: provider });
  const abort = new AbortController();
  abort.abort();

  const result = await service.createMessage(
    {
      model: "nvidia_nim/model-a",
      max_tokens: 16,
      messages: [{ role: "user", content: "hello" }],
    },
    null,
    abort.signal,
  );

  assert.equal(result.kind, "error");
  assert.equal(provider.calls, 0);
  if (result.kind === "error") {
    assert.equal(result.status, 499);
    assert.match(result.body.error.message, /aborted/);
  }
});

test("MessageService enforces provider maxConcurrency", async () => {
  const config = chainConfig();
  config.providers.nvidia_nim.maxConcurrency = 1;
  config.providers.nvidia_nim.rateLimit = 0;
  const provider = new FakeProvider([
    { stream: stalledStream() },
    { stream: usefulTextStream("should be blocked") },
  ]);
  const service = fakeService(config, { nvidia_nim: provider });

  const first = await service.createMessage({
    model: "nvidia_nim/model-a",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello" }],
  });
  const second = await service.createMessage({
    model: "nvidia_nim/model-a",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello again" }],
  });

  assert.equal(first.kind, "stream");
  assert.equal(second.kind, "error");
  assert.equal(provider.calls, 1);
  if (second.kind === "error") {
    assert.equal(second.status, 429);
    assert.match(second.body.error.message, /concurrency limit/);
  }
  if (first.kind === "stream") await first.stream.cancel();
});

test("MessageService enforces provider rateLimit window", async () => {
  const config = chainConfig();
  config.providers.nvidia_nim.maxConcurrency = 0;
  config.providers.nvidia_nim.rateLimit = 1;
  config.providers.nvidia_nim.rateWindow = 60;
  const provider = new FakeProvider([
    { stream: usefulTextStream("first") },
    { stream: usefulTextStream("should be blocked") },
  ]);
  const service = fakeService(config, { nvidia_nim: provider });

  const first = await service.createMessage({
    model: "nvidia_nim/model-a",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello" }],
  });
  if (first.kind === "stream") await readAll(first.stream);

  const second = await service.createMessage({
    model: "nvidia_nim/model-a",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello again" }],
  });

  assert.equal(second.kind, "error");
  assert.equal(provider.calls, 1);
  if (second.kind === "error") {
    assert.equal(second.status, 429);
    assert.match(second.body.error.message, /rate limit/);
  }
});

test("session history records request preview and conversion warnings", async () => {
  const previousConfigDir = process.env.CCPG_CONFIG_DIR;
  const configDir = mkdtempSync(join(tmpdir(), "ccpg-session-test-"));
  process.env.CCPG_CONFIG_DIR = configDir;
  const config = buildDefaultConfig();
  try {
    config.providers.nvidia_nim.enabled = true;
    config.activeProvider = "nvidia_nim";
    const session = startSession(config);
    const provider = new FakeProvider([
      {
        stream: usefulTextStream("preview ok"),
        requestPreview: {
          transport: "openai_chat",
          method: "POST",
          url: "https://provider.test/chat/completions",
          headers: { Authorization: "••••••••" },
          body: { model: "model-a", stream: true },
        },
        warnings: [{ code: "top_k_dropped", message: "OpenAI has no top_k equivalent." }],
      },
    ]);
    const service = fakeService(config, { nvidia_nim: provider });

    const result = await service.createMessage(
      {
        model: "nvidia_nim/model-a",
        max_tokens: 16,
        messages: [{ role: "user", content: "hello" }],
        top_k: 10,
      },
      session.id,
    );

    assert.equal(result.kind, "stream");
    if (result.kind === "stream") await readAll(result.stream);
    const entry = listCurrentSessions().find((candidate) => candidate.id === session.id)
      ?.requestLog[0];
    assert.equal(entry?.requestPreview?.transport, "openai_chat");
    assert.equal(entry?.requestPreview?.headers.Authorization, "••••••••");
    assert.equal(entry?.warnings?.[0]?.code, "top_k_dropped");
  } finally {
    endAllSessions();
    if (previousConfigDir === undefined) delete process.env.CCPG_CONFIG_DIR;
    else process.env.CCPG_CONFIG_DIR = previousConfigDir;
    rmSync(configDir, { recursive: true, force: true });
  }
});

test("direct provider transport failures return controlled Anthropic errors", async () => {
  const config = buildDefaultConfig();
  config.providers.nvidia_nim.enabled = true;
  config.activeProvider = "nvidia_nim";
  const provider = new FakeProvider([new Error("getaddrinfo ENOTFOUND provider.test")]);
  const service = fakeService(config, { nvidia_nim: provider });

  const result = await service.createMessage({
    model: "nvidia_nim/model-a",
    max_tokens: 16,
    messages: [{ role: "user", content: "hello" }],
  });

  assert.equal(result.kind, "error");
  if (result.kind === "error") {
    assert.equal(result.status, 500);
    assert.equal(result.body.error.type, "api_error");
    assert.match(result.body.error.message, /Provider nvidia_nim \(502\)/);
    assert.match(result.body.error.message, /ENOTFOUND/);
  }
});

class FakeProvider {
  calls = 0;
  lastOptions?: ProviderRequestOptions;

  constructor(private readonly results: Array<StreamResult | Error>) {}

  async streamResponse(
    _req?: unknown,
    _inputTokens?: number,
    options?: ProviderRequestOptions,
  ): Promise<StreamResult> {
    this.calls += 1;
    this.lastOptions = options;
    const result = this.results.shift() ?? { error: { status: 500, message: "no fake result" } };
    if (result instanceof Error) throw result;
    return result;
  }

  async listModels() {
    return [];
  }
}

function chainConfig(): Config {
  const config = buildDefaultConfig();
  config.providers.nvidia_nim.enabled = true;
  config.providers.deepseek.enabled = true;
  config.modelFallbacks = [
    {
      id: "chain_rescue",
      name: "Rescue",
      slug: "rescue",
      enabled: true,
      primaryAttempts: 1,
      models: [
        { providerId: "nvidia_nim", model: "primary-model" },
        { providerId: "deepseek", model: "secondary-model" },
      ],
    },
  ];
  return config;
}

function chainRequest() {
  return {
    model: "chain/rescue",
    max_tokens: 16,
    messages: [{ role: "user" as const, content: "hello" }],
  };
}

function fakeService(config: Config, providers: Record<string, FakeProvider>): MessageService {
  const registry = {
    get: (id: string) => providers[id] ?? null,
  };
  return new MessageService({
    currentConfig: () => config,
    providers: () => registry,
  } as unknown as ProxyRuntime);
}

function usefulTextStream(text: string): ReadableStream<string> {
  return streamFromChunks([
    sseMessageStart("msg_test", "test-model", 1),
    sseContentBlockStart(0, { type: "text", text: "" }),
    sseContentBlockDelta(0, { type: "text_delta", text }),
    sseMessageDelta("end_turn", 1),
    sseMessageStop(),
  ]);
}

function streamFromChunks(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function erroringStream(error: Error): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.error(error);
    },
  });
}

function stalledStream(): ReadableStream<string> {
  let timer: NodeJS.Timeout | null = null;
  return new ReadableStream<string>({
    start(controller) {
      timer = setTimeout(() => {
        controller.enqueue('data: {"type":"ping"}\n\n');
      }, 1_000);
    },
    cancel() {
      if (timer) clearTimeout(timer);
    },
  });
}

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += value;
  }
}
