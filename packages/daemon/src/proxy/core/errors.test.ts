import assert from "node:assert/strict";
import test from "node:test";
import { anthropicError, providerErrorStatus, providerErrorType } from "./errors.js";

test("anthropicError returns correct structure", () => {
  const err = anthropicError("api_error", "something went wrong");
  assert.equal(err.type, "error");
  assert.equal(err.error.type, "api_error");
  assert.equal(err.error.message, "something went wrong");
});

test("anthropicError with authentication_error type", () => {
  const err = anthropicError("authentication_error", "invalid key");
  assert.equal(err.error.type, "authentication_error");
  assert.equal(err.error.message, "invalid key");
});

test("anthropicError with not_found_error type", () => {
  const err = anthropicError("not_found_error", "model not found");
  assert.equal(err.error.type, "not_found_error");
});

test("anthropicError with rate_limit_error type", () => {
  const err = anthropicError("rate_limit_error", "too many requests");
  assert.equal(err.error.type, "rate_limit_error");
});

test("providerErrorType maps 429 to rate_limit_error", () => {
  assert.equal(providerErrorType(429), "rate_limit_error");
});

test("providerErrorType maps 401 to authentication_error", () => {
  assert.equal(providerErrorType(401), "authentication_error");
});

test("providerErrorType maps 404 to not_found_error", () => {
  assert.equal(providerErrorType(404), "not_found_error");
});

test("providerErrorType maps other status to api_error", () => {
  assert.equal(providerErrorType(500), "api_error");
  assert.equal(providerErrorType(400), "api_error");
  assert.equal(providerErrorType(503), "api_error");
});

test("providerErrorStatus passes through known error codes", () => {
  assert.equal(providerErrorStatus(400), 400);
  assert.equal(providerErrorStatus(401), 401);
  assert.equal(providerErrorStatus(403), 403);
  assert.equal(providerErrorStatus(404), 404);
  assert.equal(providerErrorStatus(429), 429);
  assert.equal(providerErrorStatus(499), 499);
});

test("providerErrorStatus maps unknown status to 500", () => {
  assert.equal(providerErrorStatus(502), 500);
  assert.equal(providerErrorStatus(503), 500);
  assert.equal(providerErrorStatus(200), 500);
  assert.equal(providerErrorStatus(422), 500);
});
