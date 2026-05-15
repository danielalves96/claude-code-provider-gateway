import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "../../config/index.js";
import { ProxyRuntime } from "../runtime.js";
import { MessageService, shouldUseNativeClaudePassthrough } from "./message-service.js";

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
