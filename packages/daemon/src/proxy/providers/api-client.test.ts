import assert from "node:assert/strict";
import test from "node:test";
import { fetchProviderJson, postProviderStream } from "./api-client.js";

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
      /HTTP 504 at https:\/\/example\.test\/models: Provider request timed out/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postProviderStream errors when total stream timeout is reached", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: {}\n\n"));
        },
      }),
      { status: 200 },
    );

  try {
    const result = await postProviderStream({
      url: "https://example.test/messages",
      headers: {},
      body: {},
      streamTotalTimeoutMs: 1,
    });
    assert.ok("body" in result);
    const reader = result.body.getReader();
    await reader.read();
    await assert.rejects(reader.read(), /Provider stream total timeout/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postProviderStream converts network failures into controlled provider errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("connect ECONNREFUSED 127.0.0.1:1234");
  };

  try {
    const result = await postProviderStream({
      url: "http://127.0.0.1:1234/messages",
      headers: {},
      body: {},
    });

    assert.ok("error" in result);
    assert.equal(result.error.status, 502);
    assert.match(result.error.message, /Provider network error/);
    assert.match(result.error.message, /ECONNREFUSED/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
