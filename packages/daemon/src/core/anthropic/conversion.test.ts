import assert from "node:assert/strict";
import test from "node:test";
import { anthropicToOpenAIWithWarnings } from "./conversion.js";
import type { MessagesRequest } from "./types.js";

test("anthropicToOpenAIWithWarnings reports dropped and translated Anthropic-only fields", () => {
  const req: MessagesRequest = {
    model: "claude-haiku",
    max_tokens: 100,
    system: [
      {
        type: "text",
        text: "system",
        cache_control: { type: "ephemeral" },
      } as unknown as { type: "text"; text: string },
    ],
    messages: [
      {
        role: "assistant",
        content: [
          { type: "text", text: "previous" },
          { type: "thinking", thinking: "hidden chain" },
        ],
      },
    ],
    tools: [{ name: "lookup", input_schema: { type: "object", properties: {} } }],
    tool_choice: { type: "any" },
    top_k: 25,
    thinking: { type: "enabled", budget_tokens: 1024 },
    metadata: { user_id: "user-1" },
  };

  const { request, warnings } = anthropicToOpenAIWithWarnings(req, "gpt-test");
  const codes = warnings.map((warning) => warning.code);

  assert.equal(request.model, "gpt-test");
  assert.equal(request.tool_choice, "required");
  assert.equal(
    request.messages.some((message) => JSON.stringify(message.content).includes("hidden")),
    false,
  );
  assert.ok(codes.includes("top_k_dropped"));
  assert.ok(codes.includes("metadata_dropped"));
  assert.ok(codes.includes("thinking_request_dropped"));
  assert.ok(codes.includes("thinking_block_dropped"));
  assert.ok(codes.includes("cache_control_metadata_dropped"));
  assert.ok(codes.includes("tool_choice_any_translated"));
});
