import assert from "node:assert/strict";
import test from "node:test";
import {
  SSE_HEADERS,
  sseContentBlockDelta,
  sseContentBlockStart,
  sseContentBlockStop,
  sseError,
  sseEvent,
  sseMessageDelta,
  sseMessageStart,
  sseMessageStop,
  ssePing,
  teeWithCapture,
} from "./writer.js";

function parseEventLine(raw: string): { event: string; data: unknown } {
  const lines = raw.split("\n").filter(Boolean);
  const eventLine = lines.find((l) => l.startsWith("event: ")) ?? "";
  const dataLine = lines.find((l) => l.startsWith("data: ")) ?? "";
  return {
    event: eventLine.slice(7).trim(),
    data: JSON.parse(dataLine.slice(6)),
  };
}

test("sseEvent produces correct format with double newline", () => {
  const out = sseEvent("ping", { type: "ping" });
  assert.ok(out.startsWith("event: ping\n"));
  assert.ok(out.includes("data: "));
  assert.ok(out.endsWith("\n\n"));
});

test("ssePing produces ping event", () => {
  const out = ssePing();
  const { event, data } = parseEventLine(out);
  assert.equal(event, "ping");
  assert.deepEqual(data, { type: "ping" });
});

test("sseMessageStart produces message_start event with correct structure", () => {
  const out = sseMessageStart("msg_123", "claude-sonnet-4-6", 50);
  const { event, data } = parseEventLine(out);
  assert.equal(event, "message_start");
  const d = data as { type: string; message: { id: string; model: string; usage: { input_tokens: number } } };
  assert.equal(d.type, "message_start");
  assert.equal(d.message.id, "msg_123");
  assert.equal(d.message.model, "claude-sonnet-4-6");
  assert.equal(d.message.usage.input_tokens, 50);
});

test("sseContentBlockStart produces content_block_start event", () => {
  const out = sseContentBlockStart(0, { type: "text", text: "" });
  const { event, data } = parseEventLine(out);
  assert.equal(event, "content_block_start");
  const d = data as { index: number; content_block: { type: string } };
  assert.equal(d.index, 0);
  assert.equal(d.content_block.type, "text");
});

test("sseContentBlockDelta produces content_block_delta event", () => {
  const out = sseContentBlockDelta(0, { type: "text_delta", text: "hello" });
  const { event, data } = parseEventLine(out);
  assert.equal(event, "content_block_delta");
  const d = data as { index: number; delta: { type: string; text: string } };
  assert.equal(d.index, 0);
  assert.equal(d.delta.type, "text_delta");
  assert.equal(d.delta.text, "hello");
});

test("sseContentBlockStop produces content_block_stop event", () => {
  const out = sseContentBlockStop(2);
  const { event, data } = parseEventLine(out);
  assert.equal(event, "content_block_stop");
  assert.equal((data as { index: number }).index, 2);
});

test("sseMessageDelta produces message_delta event with stop_reason", () => {
  const out = sseMessageDelta("end_turn", 100);
  const { event, data } = parseEventLine(out);
  assert.equal(event, "message_delta");
  const d = data as { delta: { stop_reason: string }; usage: { output_tokens: number } };
  assert.equal(d.delta.stop_reason, "end_turn");
  assert.equal(d.usage.output_tokens, 100);
});

test("sseMessageDelta handles null stop_reason", () => {
  const out = sseMessageDelta(null, 0);
  const { data } = parseEventLine(out);
  assert.equal((data as { delta: { stop_reason: null } }).delta.stop_reason, null);
});

test("sseMessageStop produces message_stop event", () => {
  const out = sseMessageStop();
  const { event, data } = parseEventLine(out);
  assert.equal(event, "message_stop");
  assert.equal((data as { type: string }).type, "message_stop");
});

test("sseError produces error event with correct structure", () => {
  const out = sseError("api_error", "something broke");
  const { event, data } = parseEventLine(out);
  assert.equal(event, "error");
  const d = data as { type: string; error: { type: string; message: string } };
  assert.equal(d.type, "error");
  assert.equal(d.error.type, "api_error");
  assert.equal(d.error.message, "something broke");
});

test("SSE_HEADERS contains required headers", () => {
  assert.equal(SSE_HEADERS["Content-Type"], "text/event-stream");
  assert.equal(SSE_HEADERS["Cache-Control"], "no-cache");
  assert.equal(SSE_HEADERS["Connection"], "keep-alive");
});

test("teeWithCapture forwards stream chunks and captures text_delta content", async () => {
  const delta = sseContentBlockDelta(0, { type: "text_delta", text: "hello world" });
  const source = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(delta);
      controller.close();
    },
  });

  const { stream, getCapturedText } = teeWithCapture(source);
  const reader = stream.getReader();
  let output = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    output += value;
  }

  assert.ok(output.includes("text_delta"));
  assert.equal(getCapturedText(), "hello world");
});

test("teeWithCapture does not capture non-text_delta content_block_delta", async () => {
  const delta = sseContentBlockDelta(0, { type: "input_json_delta", partial_json: '{"a":1}' });
  const source = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(delta);
      controller.close();
    },
  });

  const { stream, getCapturedText } = teeWithCapture(source);
  const reader = stream.getReader();
  while (!(await reader.read()).done) {}

  assert.equal(getCapturedText(), "");
});

test("teeWithCapture accumulates multiple text deltas", async () => {
  const chunks = [
    sseContentBlockDelta(0, { type: "text_delta", text: "foo" }),
    sseContentBlockDelta(0, { type: "text_delta", text: "bar" }),
  ];
  const source = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  const { stream, getCapturedText } = teeWithCapture(source);
  const reader = stream.getReader();
  while (!(await reader.read()).done) {}

  assert.equal(getCapturedText(), "foobar");
});

test("teeWithCapture ignores non-content_block_delta events", async () => {
  const source = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(ssePing());
      controller.enqueue(sseMessageStart("id", "model", 0));
      controller.close();
    },
  });

  const { stream, getCapturedText } = teeWithCapture(source);
  const reader = stream.getReader();
  while (!(await reader.read()).done) {}

  assert.equal(getCapturedText(), "");
});
