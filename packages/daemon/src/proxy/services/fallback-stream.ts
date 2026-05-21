import { type ModelFallbackConfig } from "../../config/schema.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { anthropicError } from "../errors.js";
import type { ErrorStatus } from "../errors.js";
import type { ProxyRuntime } from "../runtime.js";
import { providerErrorType } from "../errors.js";
import { tryFallbackTarget } from "./fallback-target.js";
import { sleep } from "./provider-stream.js";
import type { MessageServiceResult } from "./types.js";

const DEFAULT_PRIMARY_ATTEMPTS = 2;

export async function streamFallback(
  runtime: ProxyRuntime,
  req: MessagesRequest,
  fallback: ModelFallbackConfig,
  started: number,
  sessionId: string | null | undefined,
  abortSignal?: AbortSignal,
): Promise<MessageServiceResult> {
  if (fallback.routingStrategy === "round_robin") {
    return streamFallbackRoundRobin(runtime, req, fallback, started, sessionId, abortSignal);
  }
  return streamFallbackWaterfall(runtime, req, fallback, started, sessionId, abortSignal);
}

async function streamFallbackWaterfall(
  runtime: ProxyRuntime,
  req: MessagesRequest,
  fallback: ModelFallbackConfig,
  started: number,
  sessionId: string | null | undefined,
  abortSignal?: AbortSignal,
): Promise<MessageServiceResult> {
  let lastError: {
    status: ErrorStatus;
    message: string;
    type: ReturnType<typeof providerErrorType>;
  } | null = null;

  const primaryAttempts = fallback.primaryAttempts ?? DEFAULT_PRIMARY_ATTEMPTS;

  for (let index = 0; index < fallback.models.length; index++) {
    const target = fallback.models[index];
    const maxAttempts = index === 0 ? primaryAttempts : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await tryFallbackTarget(
        runtime,
        req,
        fallback,
        target,
        index,
        attempt,
        started,
        sessionId,
        abortSignal,
      );
      if (result.kind === "stream") return result;
      lastError = {
        status: result.status,
        message: result.body.error.message,
        type: result.body.error.type as ReturnType<typeof providerErrorType>,
      };
      if (attempt < maxAttempts && shouldRetryFallbackResult(result)) {
        await sleep(250 * attempt);
        continue;
      }
      break;
    }
  }

  const message = lastError?.message ?? `Model chain "${fallback.name}" has no available models.`;
  return {
    kind: "error",
    status: lastError?.status ?? 500,
    body: anthropicError(lastError?.type ?? "api_error", message),
  };
}

async function streamFallbackRoundRobin(
  runtime: ProxyRuntime,
  req: MessagesRequest,
  fallback: ModelFallbackConfig,
  started: number,
  sessionId: string | null | undefined,
  abortSignal?: AbortSignal,
): Promise<MessageServiceResult> {
  const primaryAttempts = fallback.primaryAttempts ?? DEFAULT_PRIMARY_ATTEMPTS;
  // Fisher-Yates shuffle so every pick — primary and fallbacks — is random
  const indices = Array.from({ length: fallback.models.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  let lastError: {
    status: ErrorStatus;
    message: string;
    type: ReturnType<typeof providerErrorType>;
  } | null = null;

  for (let pos = 0; pos < indices.length; pos++) {
    const index = indices[pos];
    const target = fallback.models[index];
    const maxAttempts = pos === 0 ? primaryAttempts : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await tryFallbackTarget(
        runtime,
        req,
        fallback,
        target,
        index,
        attempt,
        started,
        sessionId,
        abortSignal,
      );
      if (result.kind === "stream") return result;
      lastError = {
        status: result.status,
        message: result.body.error.message,
        type: result.body.error.type as ReturnType<typeof providerErrorType>,
      };
      if (attempt < maxAttempts && shouldRetryFallbackResult(result)) {
        await sleep(250 * attempt);
        continue;
      }
      break;
    }
  }

  const message = lastError?.message ?? `Model chain "${fallback.name}" has no available models.`;
  return {
    kind: "error",
    status: lastError?.status ?? 500,
    body: anthropicError(lastError?.type ?? "api_error", message),
  };
}

function shouldRetryFallbackResult(result: MessageServiceResult): boolean {
  return result.kind === "error" && (result.status === 429 || result.status === 500);
}
