import assert from "node:assert/strict";
import test from "node:test";
import { fetchProviderJson } from "./api-client.js";

test("fetchProviderJson keeps timeout disabled by default", async () => {
  let signal: AbortSignal | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await fetchProviderJson<{ ok: boolean }>({ url: "https://example.test/models", headers: {} });
    assert.equal(signal, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchProviderJson passes AbortSignal when timeout is configured", async () => {
  let signal: AbortSignal | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await fetchProviderJson<{ ok: boolean }>({
      url: "https://example.test/models",
      headers: {},
      timeoutMs: 1000,
    });
    assert.ok(signal);
    assert.equal(signal.aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchProviderJson converts configured timeout into controlled error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    await assert.rejects(
      fetchProviderJson({ url: "https://example.test/models", headers: {}, timeoutMs: 1 }),
      /HTTP 504 em https:\/\/example\.test\/models: Provider request timed out/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
