import assert from "node:assert/strict";
import test from "node:test";
import type { MessagesRequest } from "./types.js";
import { countRequestTokens } from "./tokens.js";

function makeReq(overrides?: Partial<MessagesRequest>): MessagesRequest {
  return {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [],
    ...overrides,
  };
}

test("countRequestTokens returns 0 for empty request", () => {
  const count = countRequestTokens(makeReq());
  assert.equal(count, 0);
});

test("countRequestTokens counts string message content", () => {
  const req = makeReq({ messages: [{ role: "user", content: "hello world" }] });
  const count = countRequestTokens(req);
  assert.ok(count > 0);
});

test("countRequestTokens adds system prompt tokens", () => {
  const withSystem = makeReq({ system: "You are an assistant." });
  const withoutSystem = makeReq();
  assert.ok(countRequestTokens(withSystem) > countRequestTokens(withoutSystem));
});

test("countRequestTokens counts array system prompt", () => {
  const req = makeReq({
    system: [{ type: "text", text: "Rule one. Rule two." }],
  });
  const count = countRequestTokens(req);
  assert.ok(count > 0);
});

test("countRequestTokens adds per-message overhead", () => {
  const one = makeReq({ messages: [{ role: "user", content: "hi" }] });
  const two = makeReq({
    messages: [
      { role: "user", content: "hi" },
      { role: "assistant", content: "there" },
    ],
  });
  // Second message adds tokens for content + 4 overhead
  assert.ok(countRequestTokens(two) > countRequestTokens(one));
});

test("countRequestTokens counts text blocks in content arrays", () => {
  const string = makeReq({ messages: [{ role: "user", content: "hello" }] });
  const array = makeReq({
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
  });
  // Both should produce similar token counts (array adds structure overhead handled the same)
  const diff = Math.abs(countRequestTokens(string) - countRequestTokens(array));
  assert.ok(diff < 10, `Token counts should be close: ${countRequestTokens(string)} vs ${countRequestTokens(array)}`);
});

test("countRequestTokens counts tool_use blocks", () => {
  const with_tool = makeReq({
    messages: [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "bash", input: { command: "ls" } },
        ],
      },
    ],
  });
  const count = countRequestTokens(with_tool);
  assert.ok(count > 0);
});

test("countRequestTokens counts thinking blocks", () => {
  const with_thinking = makeReq({
    messages: [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think about this step by step." },
        ],
      },
    ],
  });
  const count = countRequestTokens(with_thinking);
  assert.ok(count > 0);
});

test("countRequestTokens counts tool_result with string content", () => {
  const req = makeReq({
    messages: [
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "command output here" },
        ],
      },
    ],
  });
  const count = countRequestTokens(req);
  assert.ok(count > 0);
});

test("countRequestTokens counts tools definition", () => {
  const without = makeReq();
  const with_tools = makeReq({
    tools: [{ name: "bash", description: "run bash", input_schema: { type: "object", properties: {} } }],
  });
  assert.ok(countRequestTokens(with_tools) > countRequestTokens(without));
});

test("countRequestTokens increases with longer messages", () => {
  const short = makeReq({ messages: [{ role: "user", content: "hi" }] });
  const long = makeReq({ messages: [{ role: "user", content: "hello, this is a longer message that should produce more tokens" }] });
  assert.ok(countRequestTokens(long) > countRequestTokens(short));
});
