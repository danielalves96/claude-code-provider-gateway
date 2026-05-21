import assert from "node:assert/strict";
import test from "node:test";
import { sseContentBlockDelta } from "../../core/sse/writer.js";
import { probeStreamForUsefulAnthropicContent } from "./stream-result.js";

test("probeStreamForUsefulAnthropicContent flushes unterminated residual data at EOF", async () => {
  const stream = streamFromChunks([
    sseContentBlockDelta(0, { type: "text_delta", text: "final" }).trimEnd(),
  ]);

  const result = await probeStreamForUsefulAnthropicContent(stream, 100);

  assert.equal(result.ok, true);
});

test("probeStreamForUsefulAnthropicContent cancels upstream reader on early stream error", async () => {
  let canceled = false;
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(
        'data: {"type":"error","error":{"type":"api_error","message":"bad stream"}}\n\n',
      );
    },
    cancel() {
      canceled = true;
    },
  });

  const result = await probeStreamForUsefulAnthropicContent(stream, 100);

  assert.deepEqual(result, { ok: false, reason: "api_error: bad stream", timedOut: false });
  assert.equal(canceled, true);
});

function streamFromChunks(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}
