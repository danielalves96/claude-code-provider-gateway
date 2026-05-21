import assert from "node:assert/strict";
import test from "node:test";
import { shellQuote } from "./launch-prepare.js";

test("shellQuote preserves single argument boundaries for POSIX shells", () => {
  assert.equal(shellQuote("plain"), "'plain'");
  assert.equal(shellQuote("a'b"), "'a'\\''b'");
  assert.equal(shellQuote("$(touch /tmp/owned); echo hi"), "'$(touch /tmp/owned); echo hi'");
});
