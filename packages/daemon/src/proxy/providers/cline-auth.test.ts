import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClineHeaders,
  CLINE_REDIRECT_URI,
  createClineAuthorizationUrl,
  exchangeClineAuthorizationCode,
} from "./cline-auth.js";

test("createClineAuthorizationUrl builds extension callback URL", () => {
  const url = new URL(createClineAuthorizationUrl("state-123"));
  assert.equal(url.origin + url.pathname, "https://api.cline.bot/api/v1/auth/authorize");
  assert.equal(url.searchParams.get("client_type"), "extension");
  assert.equal(url.searchParams.get("callback_url"), CLINE_REDIRECT_URI);
  assert.equal(url.searchParams.get("redirect_uri"), CLINE_REDIRECT_URI);
  assert.equal(url.searchParams.get("state"), "state-123");
});

test("buildClineHeaders prefixes bearer token with workos scheme", () => {
  const headers = buildClineHeaders("abc123");
  assert.equal(headers.Authorization, "Bearer workos:abc123");
});

test("exchangeClineAuthorizationCode exchanges code with token endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(
      JSON.stringify({
        accessToken: "access",
        refreshToken: "refresh",
        email: "user@example.com",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await exchangeClineAuthorizationCode("auth-code");

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.cline.bot/api/v1/auth/token");
    assert.deepEqual(requests[0].body, {
      grant_type: "authorization_code",
      code: "auth-code",
      client_type: "extension",
      redirect_uri: CLINE_REDIRECT_URI,
    });
    assert.equal(result.accessToken, "access");
    assert.equal(result.refreshToken, "refresh");
    assert.equal(result.accountId, "user@example.com");
    assert.equal(result.expiresAt, Date.parse("2030-01-01T00:00:00.000Z"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
