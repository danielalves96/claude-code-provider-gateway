import assert from "node:assert/strict";
import test from "node:test";
import {
  CLI_FLAGS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_STREAM_TOTAL_TIMEOUT_MS,
  LOCAL_PROVIDER_IDS,
  OAUTH_PROVIDER_IDS,
  PROVIDER_DEFAULTS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  defaultRequestTimeoutMs,
  defaultStreamIdleTimeoutMs,
  defaultStreamTotalTimeoutMs,
} from "./schema.js";

test("PROVIDER_IDS is a non-empty readonly array", () => {
  assert.ok(Array.isArray(PROVIDER_IDS));
  assert.ok(PROVIDER_IDS.length > 0);
});

test("PROVIDER_IDS includes expected providers", () => {
  const ids = PROVIDER_IDS as readonly string[];
  assert.ok(ids.includes("copilot"));
  assert.ok(ids.includes("openrouter"));
  assert.ok(ids.includes("ollama"));
  assert.ok(ids.includes("groq"));
});

test("PROVIDER_IDS has no duplicate entries", () => {
  const set = new Set(PROVIDER_IDS);
  assert.equal(set.size, PROVIDER_IDS.length);
});

test("OAUTH_PROVIDER_IDS is a subset of PROVIDER_IDS", () => {
  const all = new Set(PROVIDER_IDS as string[]);
  for (const id of OAUTH_PROVIDER_IDS) {
    assert.ok(all.has(id), `OAuth provider ${id} not in PROVIDER_IDS`);
  }
});

test("OAUTH_PROVIDER_IDS includes copilot and openai_account", () => {
  assert.ok(OAUTH_PROVIDER_IDS.has("copilot"));
  assert.ok(OAUTH_PROVIDER_IDS.has("openai_account"));
});

test("LOCAL_PROVIDER_IDS contains local-only providers", () => {
  assert.ok(LOCAL_PROVIDER_IDS.has("ollama"));
  assert.ok(LOCAL_PROVIDER_IDS.has("lmstudio"));
  assert.ok(LOCAL_PROVIDER_IDS.has("llamacpp"));
});

test("PROVIDER_DEFAULTS has entries for each PROVIDER_ID", () => {
  for (const id of PROVIDER_IDS) {
    assert.ok(id in PROVIDER_DEFAULTS, `Missing defaults for ${id}`);
  }
});

test("PROVIDER_DEFAULTS baseUrls are valid URLs or empty", () => {
  for (const [id, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    if (defaults.baseUrl && defaults.baseUrl.length > 0) {
      assert.ok(
        defaults.baseUrl.startsWith("http://") || defaults.baseUrl.startsWith("https://"),
        `Invalid baseUrl for ${id}: ${defaults.baseUrl}`,
      );
    }
  }
});

test("PROVIDER_LABELS has entry for each PROVIDER_ID", () => {
  for (const id of PROVIDER_IDS) {
    assert.ok(id in PROVIDER_LABELS, `Missing label for ${id}`);
    assert.ok(PROVIDER_LABELS[id].length > 0, `Empty label for ${id}`);
  }
});

test("CLI_FLAGS maps to valid provider IDs", () => {
  const ids = new Set(PROVIDER_IDS as string[]);
  for (const [flag, id] of Object.entries(CLI_FLAGS)) {
    assert.ok(ids.has(id), `CLI flag ${flag} maps to unknown provider ${id}`);
  }
});

test("CLI_FLAGS all start with --", () => {
  for (const flag of Object.keys(CLI_FLAGS)) {
    assert.ok(flag.startsWith("--"), `CLI flag ${flag} should start with --`);
  }
});

test("DEFAULT_REQUEST_TIMEOUT_MS is a positive number", () => {
  assert.equal(typeof DEFAULT_REQUEST_TIMEOUT_MS, "number");
  assert.ok(DEFAULT_REQUEST_TIMEOUT_MS > 0);
});

test("DEFAULT_STREAM_IDLE_TIMEOUT_MS is a positive number", () => {
  assert.equal(typeof DEFAULT_STREAM_IDLE_TIMEOUT_MS, "number");
  assert.ok(DEFAULT_STREAM_IDLE_TIMEOUT_MS > 0);
});

test("DEFAULT_STREAM_TOTAL_TIMEOUT_MS is a positive number", () => {
  assert.equal(typeof DEFAULT_STREAM_TOTAL_TIMEOUT_MS, "number");
  assert.ok(DEFAULT_STREAM_TOTAL_TIMEOUT_MS > 0);
});

test("defaultRequestTimeoutMs returns DEFAULT_REQUEST_TIMEOUT_MS", () => {
  assert.equal(defaultRequestTimeoutMs("any_provider"), DEFAULT_REQUEST_TIMEOUT_MS);
});

test("defaultStreamIdleTimeoutMs returns DEFAULT_STREAM_IDLE_TIMEOUT_MS", () => {
  assert.equal(defaultStreamIdleTimeoutMs("any_provider"), DEFAULT_STREAM_IDLE_TIMEOUT_MS);
});

test("defaultStreamTotalTimeoutMs returns DEFAULT_STREAM_TOTAL_TIMEOUT_MS", () => {
  assert.equal(defaultStreamTotalTimeoutMs("any_provider"), DEFAULT_STREAM_TOTAL_TIMEOUT_MS);
});
