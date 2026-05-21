import assert from "node:assert/strict";
import test from "node:test";
import { sessionTotals, normalizeSessionTotals, applyRequestToSessionStats } from "./stats.js";
import type { SessionRecord, SessionRequestLogEntry } from "./types.js";

function makeEntry(overrides?: Partial<SessionRequestLogEntry>): SessionRequestLogEntry {
  return {
    id: "entry_1",
    timestamp: Date.now(),
    requestedModel: "claude-sonnet-4-6",
    providerId: "nvidia_nim",
    providerModel: "meta/llama",
    inputTokens: 100,
    latencyMs: 500,
    status: "ok",
    error: null,
    ...overrides,
  };
}

function makeSession(overrides?: Partial<SessionRecord>): SessionRecord {
  return {
    id: "sess_1",
    startedAt: Date.now(),
    endedAt: null,
    durationMs: 0,
    status: "running",
    modelMode: "all",
    activeProvider: "nvidia_nim",
    launchHint: "all",
    enabledProviders: ["nvidia_nim"],
    providerStats: {},
    modelStats: {},
    requestLog: [],
    totalRequests: 0,
    totalErrors: 0,
    ...overrides,
  };
}

test("sessionTotals computes totals from modelStats", () => {
  const session = makeSession({
    modelStats: {
      "claude-sonnet-4-6": { requests: 5, errors: 2, inputTokens: 500, totalLatencyMs: 1000, avgLatencyMs: 200, lastActivityAt: null, lastProviderId: null, lastProviderModel: null, lastError: null },
      "gpt-4o": { requests: 3, errors: 0, inputTokens: 300, totalLatencyMs: 600, avgLatencyMs: 200, lastActivityAt: null, lastProviderId: null, lastProviderModel: null, lastError: null },
    },
  });

  const totals = sessionTotals(session);
  assert.equal(totals.totalRequests, 8);
  assert.equal(totals.totalErrors, 2);
});

test("sessionTotals falls back to requestLog when modelStats is empty", () => {
  const session = makeSession({
    requestLog: [
      makeEntry({ status: "ok" }),
      makeEntry({ status: "ok" }),
      makeEntry({ status: "error", error: "timeout" }),
    ],
  });

  const totals = sessionTotals(session);
  assert.equal(totals.totalRequests, 3);
  assert.equal(totals.totalErrors, 1);
});

test("sessionTotals falls back to providerStats when both modelStats and requestLog are empty", () => {
  const session = makeSession({
    providerStats: {
      nvidia_nim: { requests: 4, errors: 2, avgLatencyMs: 100, totalLatencyMs: 400, lastActivityAt: null, lastError: null },
    },
  });

  const totals = sessionTotals(session);
  assert.equal(totals.totalRequests, 4);
  assert.equal(totals.totalErrors, 2);
});

test("sessionTotals returns zeros for empty session", () => {
  const session = makeSession();
  const totals = sessionTotals(session);
  assert.equal(totals.totalRequests, 0);
  assert.equal(totals.totalErrors, 0);
});

test("normalizeSessionTotals adds computed totals", () => {
  const session = makeSession({
    requestLog: [makeEntry(), makeEntry({ status: "error" })],
  });

  const normalized = normalizeSessionTotals(session);
  assert.equal(normalized.totalRequests, 2);
  assert.equal(normalized.totalErrors, 1);
  assert.equal(normalized.id, session.id);
});

test("applyRequestToSessionStats appends to requestLog", () => {
  const session = makeSession();
  applyRequestToSessionStats(session, makeEntry({ requestedModel: "claude-opus" }));

  assert.equal(session.requestLog.length, 1);
  assert.equal(session.requestLog[0].requestedModel, "claude-opus");
  assert.equal(session.totalRequests, 1);
  assert.equal(session.totalErrors, 0);
});

test("applyRequestToSessionStats updates modelStats", () => {
  const session = makeSession();
  applyRequestToSessionStats(session, makeEntry({ requestedModel: "claude-sonnet", inputTokens: 200, latencyMs: 300 }));

  const modelStat = session.modelStats["claude-sonnet"];
  assert.ok(modelStat);
  assert.equal(modelStat.requests, 1);
  assert.equal(modelStat.inputTokens, 200);
  assert.equal(modelStat.totalLatencyMs, 300);
  assert.equal(modelStat.avgLatencyMs, 300);
  assert.equal(modelStat.lastProviderId, "nvidia_nim");
  assert.equal(modelStat.lastProviderModel, "meta/llama");
});

test("applyRequestToSessionStats accumulates modelStats", () => {
  const session = makeSession();
  applyRequestToSessionStats(session, makeEntry({ requestedModel: "claude-sonnet", inputTokens: 200, latencyMs: 300 }));
  applyRequestToSessionStats(session, makeEntry({ requestedModel: "claude-sonnet", inputTokens: 100, latencyMs: 100 }));

  const modelStat = session.modelStats["claude-sonnet"];
  assert.equal(modelStat.requests, 2);
  assert.equal(modelStat.inputTokens, 300);
  assert.equal(modelStat.totalLatencyMs, 400);
  assert.equal(modelStat.avgLatencyMs, 200);
});

test("applyRequestToSessionStats updates providerStats", () => {
  const session = makeSession();
  applyRequestToSessionStats(session, makeEntry({ providerId: "copilot", providerModel: "gpt-4o", latencyMs: 500 }));

  const providerStat = session.providerStats.copilot;
  assert.ok(providerStat);
  assert.equal(providerStat.requests, 1);
  assert.equal(providerStat.totalLatencyMs, 500);
  assert.equal(providerStat.avgLatencyMs, 500);
});

test("applyRequestToSessionStats tracks errors", () => {
  const session = makeSession();
  applyRequestToSessionStats(session, makeEntry({ status: "error", error: "ECONNREFUSED" }));
  applyRequestToSessionStats(session, makeEntry({ status: "ok", error: null }));

  assert.equal(session.totalRequests, 2);
  assert.equal(session.totalErrors, 1);

  const modelStat = session.modelStats["claude-sonnet-4-6"];
  assert.equal(modelStat.errors, 1);
  // nextModelStat overwrites lastError on every entry (including success entries with null)
  assert.equal(modelStat.lastError, null);
});

test("applyRequestToSessionStats caps requestLog at 120 entries", () => {
  const session = makeSession();
  for (let i = 0; i < 150; i++) {
    applyRequestToSessionStats(session, makeEntry({ id: `entry_${i}` }));
  }

  assert.equal(session.requestLog.length, 120);
  assert.equal(session.totalRequests, 150);
});

test("applyRequestToSessionStats updates lastActivityAt on modelStats", () => {
  const session = makeSession();
  const timestamp = 1700000000000;
  applyRequestToSessionStats(session, makeEntry({ timestamp, requestedModel: "claude-sonnet" }));

  const modelStat = session.modelStats["claude-sonnet"];
  assert.equal(modelStat.lastActivityAt, timestamp);
});
