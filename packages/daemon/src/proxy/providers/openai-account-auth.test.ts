import assert from "node:assert/strict";
import test from "node:test";
import { exchangeAuthorizationCode } from "./openai-account-auth.js";

test("exchangeAuthorizationCode explains OpenAI unsupported region token errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "unsupported_country_region_territory",
          message: "Country, region, or territory not supported",
          type: "request_forbidden",
        },
      }),
      { status: 403 },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => exchangeAuthorizationCode("code", "verifier"),
      /outbound network is in an unsupported country, region, or territory/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
