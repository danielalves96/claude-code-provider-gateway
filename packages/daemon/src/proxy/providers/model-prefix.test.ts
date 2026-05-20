import assert from "node:assert/strict";
import test from "node:test";
import { stripGatewayProviderPrefix } from "./model-prefix.js";

test("stripGatewayProviderPrefix strips provider prefixes", () => {
  assert.equal(stripGatewayProviderPrefix("groq/llama-3.3-70b", "groq"), "llama-3.3-70b");
});

test("stripGatewayProviderPrefix strips anthropic and provider prefixes in sequence", () => {
  assert.equal(stripGatewayProviderPrefix("anthropic/groq/llama-3.3-70b", "groq"), "llama-3.3-70b");
});

test("stripGatewayProviderPrefix preserves non-matching provider segments", () => {
  assert.equal(stripGatewayProviderPrefix("anthropic/openai/gpt-5.4", "groq"), "openai/gpt-5.4");
});
