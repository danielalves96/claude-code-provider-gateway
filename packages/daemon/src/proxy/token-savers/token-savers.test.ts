import assert from "node:assert/strict";
import { test } from "node:test";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { injectCaveman } from "./caveman.js";
import { compressMessages } from "./rtk.js";

test("RTK compresses large tool_result grep output", () => {
  const lines = Array.from(
    { length: 30 },
    (_, i) => `src/file-${i % 3}.ts:${i + 1}:const value${i} = true`,
  );
  const req = baseRequest(lines.join("\n"));

  const before = toolContent(req).length;
  const stats = compressMessages(req, true);
  const after = toolContent(req).length;

  assert.ok(stats);
  assert.ok(stats.hits.some((hit) => hit.filter === "grep"));
  assert.ok(after < before);
  assert.match(toolContent(req), /matches in 3F/);
});

test("RTK leaves errored tool_result content untouched", () => {
  const req = baseRequest("src/a.ts:1:value\n".repeat(80), true);

  const before = toolContent(req);
  const stats = compressMessages(req, true);

  assert.equal(toolContent(req), before);
  assert.equal(stats?.hits.length, 0);
});

test("caveman injects terse guidance into existing system prompt", () => {
  const req = baseRequest("small");
  req.system = "Existing rules.";

  injectCaveman(req, true, "ultra");

  assert.equal(typeof req.system, "string");
  assert.match(req.system as string, /Existing rules\./);
  assert.match(req.system as string, /ultra-terse/);
});

test("caveman inserts before last cache_control block to preserve prompt cache", () => {
  const req = baseRequest("small");
  req.system = [
    { type: "text", text: "rule A" },
    { type: "text", text: "rule B", cache_control: { type: "ephemeral" } } as {
      type: "text";
      text: string;
    },
    { type: "text", text: "rule C" },
  ];

  injectCaveman(req, true, "full");

  assert.ok(Array.isArray(req.system));
  const texts = (req.system as Array<{ text: string }>).map((b) => b.text);
  const cavemanIdx = texts.findIndex((t) => /terse caveman/.test(t));
  const cachedIdx = texts.indexOf("rule B");
  assert.ok(cavemanIdx >= 0 && cachedIdx >= 0);
  assert.ok(
    cavemanIdx < cachedIdx,
    `caveman (${cavemanIdx}) must come before cached block (${cachedIdx})`,
  );
});

test("caveman appends to system array when no cache_control present", () => {
  const req = baseRequest("small");
  req.system = [
    { type: "text", text: "rule A" },
    { type: "text", text: "rule B" },
  ];

  injectCaveman(req, true, "lite");

  assert.ok(Array.isArray(req.system));
  const arr = req.system as Array<{ text: string }>;
  assert.equal(arr.length, 3);
  assert.match(arr[2]?.text, /terse/);
});

function baseRequest(toolResult: string, isError = false): MessagesRequest {
  return {
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_123",
            content: toolResult,
            is_error: isError,
          },
        ],
      },
    ],
  };
}

function toolContent(req: MessagesRequest): string {
  const content = req.messages[0]?.content;
  assert.ok(Array.isArray(content));
  const block = content[0];
  assert.equal(block?.type, "tool_result");
  if (block.type !== "tool_result" || typeof block.content !== "string") {
    throw new Error("expected string tool_result content");
  }
  return block.content;
}
