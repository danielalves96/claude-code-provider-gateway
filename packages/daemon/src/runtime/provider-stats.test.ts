import assert from "node:assert/strict";
import test from "node:test";
import { getStats, getUptimeMs, recordRequest } from "./provider-stats.js";

test("recordRequest initializes and records stats for a provider", () => {
  recordRequest("test_provider", 150, null);
  const stats = getStats();

  assert.ok(stats.test_provider);
  assert.equal(stats.test_provider.requests, 1);
  assert.equal(stats.test_provider.errors, 0);
  assert.equal(stats.test_provider.totalLatencyMs, 150);
  assert.equal(stats.test_provider.avgLatencyMs, 150);
  assert.ok(typeof stats.test_provider.lastActivityAt === "number");
  assert.equal(stats.test_provider.lastError, null);
});

test("recordRequest increments requests and accumulates latency", () => {
  recordRequest("multi", 100, null);
  recordRequest("multi", 200, null);
  recordRequest("multi", 300, null);
  const stats = getStats();

  assert.equal(stats.multi.requests, 3);
  assert.equal(stats.multi.errors, 0);
  assert.equal(stats.multi.totalLatencyMs, 600);
  assert.equal(stats.multi.avgLatencyMs, 200);
});

test("recordRequest records errors", () => {
  recordRequest("err_provider", 50, "timeout");
  recordRequest("err_provider", 50, "connection refused");
  const stats = getStats();

  assert.equal(stats.err_provider.requests, 2);
  assert.equal(stats.err_provider.errors, 2);
  assert.equal(stats.err_provider.lastError, "connection refused");
});

test("recordRequest accepts synthetic keys like anthropic_native", () => {
  recordRequest("anthropic_native", 75, null);
  const stats = getStats();

  assert.ok(stats.anthropic_native);
  assert.equal(stats.anthropic_native.requests, 1);
});

test("getStats returns avgLatencyMs 0 for providers with no requests", () => {
  recordRequest("empty_stats", 0, null);
  // getStats creates entries only for recorded keys
  const stats = getStats();
  assert.equal(stats.empty_stats.avgLatencyMs, 0);
});

test("getUptimeMs returns positive milliseconds", () => {
  const uptime = getUptimeMs();
  assert.ok(typeof uptime === "number");
  assert.ok(uptime >= 0);
});

test("getUptimeMs increases over time", async () => {
  const first = getUptimeMs();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = getUptimeMs();
  assert.ok(second > first);
});

test("recordRequest updates lastActivityAt to now", () => {
  const before = Date.now();
  recordRequest("activity_test", 10, null);
  const after = Date.now();
  const stats = getStats();

  assert.ok(stats.activity_test.lastActivityAt !== null);
  if (stats.activity_test.lastActivityAt !== null) {
    assert.ok(stats.activity_test.lastActivityAt >= before);
    assert.ok(stats.activity_test.lastActivityAt <= after);
  }
});

test("recordRequest with error sets lastError", () => {
  recordRequest("first_error", 10, "first error");
  recordRequest("first_error", 10, "second error");
  const stats = getStats();

  assert.equal(stats.first_error.lastError, "second error");
});

test("recordRequest with null error after error preserves lastError", () => {
  recordRequest("mixed", 10, "only error");
  recordRequest("mixed", 10, null);
  const stats = getStats();

  assert.equal(stats.mixed.errors, 1);
  assert.equal(stats.mixed.lastError, "only error");
});
