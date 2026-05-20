import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultConfig } from "../../config/index.js";
import { createProxyApp } from "../app.js";

test("Anthropic routes reject invalid API key without changing error contract", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = createProxyApp(config, { loadConfig: () => config });

  const response = await app.request("/v1/messages/count_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      messages: [{ role: "user", content: "hello" }],
    }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    type: "error",
    error: { type: "authentication_error", message: "Invalid API key" },
  });
});

test("Anthropic routes keep count_tokens available with valid API key", async () => {
  const config = buildDefaultConfig();
  config.server.authToken = "secret";
  const app = createProxyApp(config, { loadConfig: () => config });

  const response = await app.request("/v1/messages/count_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      messages: [{ role: "user", content: "hello" }],
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { input_tokens?: number };
  assert.equal(typeof body.input_tokens, "number");
});
