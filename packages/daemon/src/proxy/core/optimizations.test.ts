import assert from "node:assert/strict";
import test from "node:test";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { tryOptimize } from "./optimizations.js";

function makeReq(overrides?: Partial<MessagesRequest>): MessagesRequest {
  return {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "hello" }],
    ...overrides,
  };
}

function msgReq(text: string, maxTokens = 1024): MessagesRequest {
  return makeReq({ max_tokens: maxTokens, messages: [{ role: "user", content: text }] });
}

async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    result += value;
  }
  return result;
}

test("tryOptimize returns handled:false for normal messages", () => {
  const result = tryOptimize(msgReq("What is the weather today?"));
  assert.equal(result.handled, false);
});

test("tryOptimize handles GET_NETWORK_INFO probe", async () => {
  const result = tryOptimize(msgReq("GET_NETWORK_INFO please"));
  assert.equal(result.handled, true);
  if (result.handled) {
    const text = await readStream(result.stream);
    assert.match(text, /127\.0\.0\.1/);
  }
});

test("tryOptimize handles curl checkip probe", async () => {
  const result = tryOptimize(msgReq("curl https://checkip.amazonaws.com"));
  assert.equal(result.handled, true);
  if (result.handled) {
    const text = await readStream(result.stream);
    assert.match(text, /127\.0\.0\.1/);
  }
});

test("tryOptimize handles title generation with max_tokens <= 40", async () => {
  const result = tryOptimize(msgReq("Generate a title for this conversation", 40));
  assert.equal(result.handled, true);
  if (result.handled) {
    const text = await readStream(result.stream);
    assert.match(text, /Untitled/);
  }
});

test("tryOptimize does not handle title when max_tokens > 40", () => {
  const result = tryOptimize(msgReq("Generate a title for this conversation", 41));
  assert.equal(result.handled, false);
});

test("tryOptimize handles filepath probe with max_tokens <= 200 and short messages", async () => {
  const result = tryOptimize(
    makeReq({
      max_tokens: 100,
      messages: [{ role: "user", content: "suggest a filepath for this code" }],
    }),
  );
  assert.equal(result.handled, true);
  if (result.handled) {
    const text = await readStream(result.stream);
    assert.match(text, /\[\]/);
  }
});

test("tryOptimize does not handle filepath probe with too many messages", () => {
  const result = tryOptimize(
    makeReq({
      max_tokens: 100,
      messages: [
        { role: "user", content: "message 1" },
        { role: "assistant", content: "response 1" },
        { role: "user", content: "suggest a filepath" },
      ],
    }),
  );
  assert.equal(result.handled, false);
});

test("tryOptimize handles file path probe (with space)", async () => {
  const result = tryOptimize(
    makeReq({
      max_tokens: 150,
      messages: [{ role: "user", content: "suggest a file path" }],
    }),
  );
  assert.equal(result.handled, true);
});

test("tryOptimize extracts text from array content blocks", () => {
  const result = tryOptimize(
    makeReq({
      max_tokens: 30,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Please give a title" },
            { type: "text", text: " for this." },
          ],
        },
      ],
    }),
  );
  assert.equal(result.handled, true);
});

test("tryOptimize returns handled:false for empty messages", () => {
  const result = tryOptimize(makeReq({ messages: [] }));
  assert.equal(result.handled, false);
});

test("tryOptimize stream contains proper SSE format", async () => {
  const result = tryOptimize(msgReq("GET_NETWORK_INFO"));
  assert.equal(result.handled, true);
  if (result.handled) {
    const text = await readStream(result.stream);
    assert.match(text, /event: ping/);
    assert.match(text, /event: message_start/);
    assert.match(text, /event: message_stop/);
  }
});
