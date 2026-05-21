import assert from "node:assert/strict";
import test from "node:test";
import type { MessagesRequest } from "../../../core/anthropic/types.js";
import { serializePrompt } from "./prompt-serializer.js";

function makeReq(overrides?: Partial<MessagesRequest>): MessagesRequest {
  return {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [],
    ...overrides,
  };
}

test("serializePrompt includes string system prompt", () => {
  const req = makeReq({
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "hello" }],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /\[System\]/);
  assert.match(output, /You are a helpful assistant/);
});

test("serializePrompt includes array system prompt", () => {
  const req = makeReq({
    system: [
      { type: "text", text: "Rule one." },
      { type: "text", text: "Rule two." },
    ],
    messages: [],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /Rule one/);
  assert.match(output, /Rule two/);
});

test("serializePrompt formats user and assistant messages", () => {
  const req = makeReq({
    messages: [
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "It is 4." },
    ],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /\[user\]/);
  assert.match(output, /What is 2\+2\?/);
  assert.match(output, /\[assistant\]/);
  assert.match(output, /It is 4\./);
});

test("serializePrompt handles array message content (text blocks only)", () => {
  const req = makeReq({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Part A" },
          { type: "text", text: "Part B" },
        ],
      },
    ],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /Part A/);
  assert.match(output, /Part B/);
});

test("serializePrompt skips non-text content blocks", () => {
  const req = makeReq({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "visible text" },
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: "hidden result",
          },
        ],
      },
    ],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /visible text/);
  assert.doesNotMatch(output, /hidden result/);
});

test("serializePrompt with first=true does not truncate system prompt", () => {
  const longSystem = "A".repeat(5000);
  const req = makeReq({ system: longSystem, messages: [] });
  const output = serializePrompt(req, true);
  assert.ok(output.includes("A".repeat(4000)));
});

test("serializePrompt with first=false truncates system prompt at 4000 chars", () => {
  const longSystem = "A".repeat(5000);
  const req = makeReq({ system: longSystem, messages: [] });
  const output = serializePrompt(req, false);
  assert.ok(!output.includes("A".repeat(4001)));
  assert.match(output, /…/);
});

test("serializePrompt without system omits System section", () => {
  const req = makeReq({ messages: [{ role: "user", content: "hi" }] });
  const output = serializePrompt(req, true);
  assert.doesNotMatch(output, /\[System\]/);
});

test("serializePrompt with empty messages returns system only", () => {
  const req = makeReq({ system: "sys", messages: [] });
  const output = serializePrompt(req, true);
  assert.match(output, /\[System\]/);
  assert.doesNotMatch(output, /\[user\]/);
});

test("serializePrompt separates sections with double newline", () => {
  const req = makeReq({
    system: "sys",
    messages: [{ role: "user", content: "msg" }],
  });
  const output = serializePrompt(req, true);
  assert.match(output, /\[System\]\nsys\n\n\[user\]\nmsg/);
});
