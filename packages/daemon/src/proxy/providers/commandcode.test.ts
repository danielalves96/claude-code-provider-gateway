import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderConfig } from "../../config/schema.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import {
  anthropicToCommandCode,
  CommandCodeProvider,
  commandCodeStreamToAnthropic,
} from "./commandcode.js";

const encoder = new TextEncoder();

test("anthropicToCommandCode builds the CommandCode envelope from Anthropic messages", async () => {
  const req: MessagesRequest = {
    model: "anthropic/commandcode/moonshotai/Kimi-K2.6",
    system: [{ type: "text", text: "You are concise." }],
    max_tokens: 1234,
    temperature: 0.2,
    top_p: 0.8,
    messages: [
      { role: "user", content: "Run the tool" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "I will check." },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "Bash",
            input: { command: "pwd" },
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "OK" }],
      },
    ],
    tools: [
      {
        name: "Bash",
        description: "Run shell commands",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    ],
  };

  const out = await anthropicToCommandCode(req);

  assert.equal(out.params.model, "moonshotai/Kimi-K2.6");
  assert.equal(out.params.stream, true);
  assert.equal(out.params.max_tokens, 1234);
  assert.equal(out.params.temperature, 0.2);
  assert.equal(out.params.top_p, 0.8);
  assert.equal(out.params.system, "You are concise.");
  assert.deepEqual(out.params.messages, [
    { role: "user", content: "Run the tool" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "I will check." },
        {
          type: "tool-call",
          toolCallId: "toolu_1",
          toolName: "Bash",
          input: { command: "pwd" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "toolu_1",
          toolName: "Bash",
          output: { type: "text", value: "OK" },
        },
      ],
    },
  ]);
  assert.deepEqual(out.params.tools, [
    {
      name: "Bash",
      description: "Run shell commands",
      input_schema: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  ]);
});

test("anthropicToCommandCode preserves image blocks and stringifies single text messages", async () => {
  const out = await anthropicToCommandCode({
    model: "anthropic/commandcode/moonshotai/Kimi-K2.6",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "See this image" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "aGVsbG8=",
            },
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "analisando" }],
      },
    ],
  });

  assert.deepEqual(out.params.messages, [
    {
      role: "user",
      content: [
        { type: "text", text: "See this image" },
        { type: "image", image: "data:image/png;base64,aGVsbG8=" },
      ],
    },
    { role: "assistant", content: [{ type: "reasoning", text: "analisando" }] },
  ]);
});

test("anthropicToCommandCode omits unsupported document blocks", async () => {
  const out = await anthropicToCommandCode({
    model: "anthropic/commandcode/moonshotai/Kimi-K2.6",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            title: "attachment.bin",
            source: {
              type: "base64",
              media_type: "application/octet-stream",
              data: Buffer.from("unsupported document").toString("base64"),
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(out.params.messages, [
    { role: "user", content: "[document omitted: attachment.bin]" },
  ]);
});

test("CommandCodeProvider posts to the configured generate endpoint with CommandCode headers", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedHeaders: Headers;
  let capturedBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = new Headers(init?.headers);
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(streamFromLines([{ type: "finish" }]), { status: 200 });
  };

  try {
    const provider = new CommandCodeProvider(commandCodeConfig());
    const result = await provider.streamResponse(
      {
        model: "anthropic/commandcode/deepseek/deepseek-v4-pro",
        max_tokens: 100,
        messages: [{ role: "user", content: "hi" }],
      },
      3,
    );

    assert.ok(!("error" in result));
    assert.equal(capturedUrl, "https://api.commandcode.ai/alpha/generate");
    assert.equal(capturedHeaders!.get("Authorization"), "Bearer user_test");
    assert.equal(capturedHeaders!.get("Content-Type"), "application/json");
    assert.equal(capturedHeaders!.get("Accept"), "text/event-stream");
    assert.equal(capturedHeaders!.get("x-command-code-version"), "0.25.7");
    assert.equal(capturedHeaders!.get("x-cli-environment"), "cli");
    assert.match(capturedHeaders!.get("x-session-id") ?? "", /^[0-9a-f-]{36}$/i);
    assert.equal(
      (capturedBody!.params as Record<string, unknown>).model,
      "deepseek/deepseek-v4-pro",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("commandCodeStreamToAnthropic converts text, reasoning, tool input, finish, and usage", async () => {
  const stream = commandCodeStreamToAnthropic(
    streamFromLines([
      { type: "reasoning-delta", text: "think" },
      { type: "text-delta", text: "Hello" },
      { type: "tool-input-start", id: "call_1", toolName: "Bash" },
      { type: "tool-input-delta", id: "call_1", delta: '{"command"' },
      { type: "tool-input-delta", id: "call_1", delta: ':"pwd"}' },
      { type: "tool-input-end", id: "call_1" },
      {
        type: "finish-step",
        finishReason: "tool-calls",
        usage: { outputTokens: 9 },
      },
      { type: "finish" },
    ]),
    { messageId: "msg_test", model: "commandcode/model", inputTokens: 7 },
  );

  const events = parseSse(await readAll(stream));

  assert.deepEqual(
    events.map((event) => event.event),
    [
      "ping",
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_start",
      "content_block_delta",
      "content_block_start",
      "content_block_delta",
      "content_block_delta",
      "content_block_stop",
      "content_block_stop",
      "content_block_stop",
      "message_delta",
      "message_stop",
    ],
  );
  assert.deepEqual(events[2]?.data.content_block, {
    type: "thinking",
    thinking: "",
  });
  assert.deepEqual(events[3]?.data.delta, {
    type: "thinking_delta",
    thinking: "think",
  });
  assert.deepEqual(events[5]?.data.delta, {
    type: "text_delta",
    text: "Hello",
  });
  assert.deepEqual(events[6]?.data.content_block, {
    type: "tool_use",
    id: "call_1",
    name: "Bash",
    input: {},
  });
  assert.deepEqual(events[7]?.data.delta, {
    type: "input_json_delta",
    partial_json: '{"command"',
  });
  assert.deepEqual(events[8]?.data.delta, {
    type: "input_json_delta",
    partial_json: ':"pwd"}',
  });
  assert.equal(events[12]?.data.delta.stop_reason, "tool_use");
  assert.equal(events[12]?.data.usage.output_tokens, 9);
});

test("commandCodeStreamToAnthropic emits a consolidated final tool-call when no input deltas arrive", async () => {
  const stream = commandCodeStreamToAnthropic(
    streamFromLines([
      {
        type: "tool-call",
        toolCallId: "call_final",
        toolName: "Read",
        input: { path: "/tmp/a" },
      },
      { type: "finish", finishReason: "stop" },
    ]),
    { messageId: "msg_test", model: "commandcode/model", inputTokens: 1 },
  );

  const events = parseSse(await readAll(stream));
  const toolStart = events.find((event) => event.data.content_block?.type === "tool_use");
  const toolDelta = events.find((event) => event.data.delta?.type === "input_json_delta");
  const messageDelta = events.find((event) => event.event === "message_delta");

  assert.deepEqual(toolStart?.data.content_block, {
    type: "tool_use",
    id: "call_final",
    name: "Read",
    input: {},
  });
  assert.equal(toolDelta?.data.delta.partial_json, JSON.stringify({ path: "/tmp/a" }));
  assert.equal(messageDelta?.data.delta.stop_reason, "end_turn");
});

test("commandCodeStreamToAnthropic turns empty HTTP 200 bodies into a valid text response", async () => {
  const stream = commandCodeStreamToAnthropic(streamFromLines([{ type: "finish" }]), {
    messageId: "msg_test",
    model: "commandcode/model",
    inputTokens: 1,
  });

  const events = parseSse(await readAll(stream));
  const textDelta = events.find((event) => event.data.delta?.type === "text_delta");
  assert.equal(
    textDelta?.data.delta.text,
    "CommandCode returned an empty response for this request.",
  );
  assert.ok(events.some((event) => event.event === "message_stop"));
});

test("commandCodeStreamToAnthropic renders CommandCode 200 error objects as text", async () => {
  const stream = commandCodeStreamToAnthropic(
    streamFromLines([
      {
        success: false,
        error: { message: "Validation error: Invalid input: expected string" },
      },
    ]),
    { messageId: "msg_test", model: "commandcode/model", inputTokens: 1 },
  );

  const events = parseSse(await readAll(stream));
  const textDelta = events.find((event) => event.data.delta?.type === "text_delta");
  assert.equal(
    textDelta?.data.delta.text,
    "CommandCode error: Validation error: Invalid input: expected string",
  );
  assert.ok(!events.some((event) => event.event === "error"));
  assert.ok(events.some((event) => event.event === "message_stop"));
});

test("commandCodeStreamToAnthropic closes the message when upstream errors after content", async () => {
  const stream = commandCodeStreamToAnthropic(
    errorAfterLines([{ type: "text-delta", text: "hi" }]),
    {
      messageId: "msg_test",
      model: "commandcode/model",
      inputTokens: 1,
    },
  );

  const events = parseSse(await readAll(stream));

  assert.ok(events.some((event) => event.event === "error"));
  assert.ok(events.some((event) => event.event === "content_block_stop"));
  assert.ok(events.some((event) => event.event === "message_delta"));
  assert.ok(events.some((event) => event.event === "message_stop"));
});

test("CommandCodeProvider lists CommandCode models from the official docs and requires an API key", async () => {
  await assert.rejects(
    new CommandCodeProvider({
      ...commandCodeConfig(),
      apiKey: "",
    }).listModels(),
    /Command Code API key is missing/,
  );

  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return new Response(
      [
        "Models.",
        "taste-1 Learns and applies your personal coding style across every session",
        "Kimi K2.6 Long-horizon coding tasks with vision and design",
        "DeepSeek V4 Flash Fast, cost-efficient reasoning at scale",
        "Model pricing.",
      ].join("\n"),
      { status: 200 },
    );
  };

  try {
    const models = await new CommandCodeProvider(commandCodeConfig()).listModels();
    assert.equal(capturedUrl, "https://commandcode.ai/docs/resources/pricing-limits");
    assert.deepEqual(
      models.map((model) => model.id),
      [
        "anthropic/commandcode/taste-1",
        "anthropic/commandcode/moonshotai/Kimi-K2.6",
        "anthropic/commandcode/deepseek/deepseek-v4-flash",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CommandCodeProvider falls back to the bundled CommandCode model catalog", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not found", { status: 404 });

  try {
    const models = await new CommandCodeProvider(commandCodeConfig()).listModels();
    assert.ok(models.some((model) => model.id === "anthropic/commandcode/moonshotai/Kimi-K2.6"));
    assert.ok(models.some((model) => model.display_name === "Command Code · DeepSeek V4 Pro"));
    assert.ok(models.some((model) => model.id === "anthropic/commandcode/taste-1"));
    assert.ok(models.some((model) => model.id === "anthropic/commandcode/openai/gpt-5.5"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("CommandCodeProvider appends manually configured extra models", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not found", { status: 404 });

  try {
    const models = await new CommandCodeProvider({
      ...commandCodeConfig(),
      models: ["anthropic/commandcode/custom/new-model", "custom/second-model", "taste-1"],
    }).listModels();

    assert.ok(models.some((model) => model.id === "anthropic/commandcode/custom/new-model"));
    assert.ok(models.some((model) => model.id === "anthropic/commandcode/custom/second-model"));
    assert.equal(models.filter((model) => model.id === "anthropic/commandcode/taste-1").length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function commandCodeConfig(): ProviderConfig {
  return {
    enabled: true,
    apiKey: "user_test",
    authType: "api_key",
    baseUrl: "https://api.commandcode.ai/alpha/generate",
    rateLimit: 40,
    rateWindow: 60,
    maxConcurrency: 5,
  };
}

function streamFromLines(events: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
}

function errorAfterLines(events: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  const queue = events.map((e) => encoder.encode(`${JSON.stringify(e)}\n`));
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < queue.length) {
        controller.enqueue(queue[index++]);
      } else {
        controller.error(new Error("upstream broke"));
      }
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

function parseSse(input: string): Array<{ event: string; data: Record<string, any> }> {
  return input
    .trim()
    .split("\n\n")
    .map((frame) => {
      const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
      const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
      return {
        event: eventLine?.slice("event: ".length) ?? "",
        data: JSON.parse(dataLine?.slice("data: ".length) ?? "{}") as Record<string, any>,
      };
    });
}
