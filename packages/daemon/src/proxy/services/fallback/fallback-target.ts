import {
  defaultRequestTimeoutMs,
  defaultStreamIdleTimeoutMs,
  defaultStreamTotalTimeoutMs,
  type ModelFallbackConfig,
  type ModelFallbackEntry,
} from "../../../config/schema.js";
import { countRequestTokens } from "../../../core/anthropic/tokens.js";
import type { MessagesRequest } from "../../../core/anthropic/types.js";
import { logger } from "../../../observability/log.js";
import {
  getSessionConfig,
  getSessionPrimaryModel,
  isFirstSessionRequest,
  recordSessionRequest,
  setSessionPrimaryModel,
} from "../../../runtime/sessions/index.js";
import { recordRequest } from "../../../runtime/provider-stats.js";
import { anthropicError, providerErrorStatus, providerErrorType } from "../../core/index.js";
import type { ErrorStatus } from "../../core/index.js";
import type { ProxyRuntime } from "../../runtime.js";
import { cloneMessagesRequest } from "../../token-savers/index.js";
import { serializePrompt } from "../shared/prompt-serializer.js";
import { limitedProviderStream, logWarnings } from "../streaming/provider-stream.js";
import { probeStreamForUsefulAnthropicContent } from "../streaming/stream-probe.js";
import { streamResultWithCapture } from "../streaming/stream-result.js";
import { applyTokenSavers } from "../shared/token-saver-pipeline.js";
import type { MessageServiceResult } from "../shared/types.js";

export async function tryFallbackTarget(
  runtime: ProxyRuntime,
  req: MessagesRequest,
  fallback: ModelFallbackConfig,
  target: ModelFallbackEntry,
  index: number,
  attempt: number,
  started: number,
  sessionId: string | null | undefined,
  abortSignal?: AbortSignal,
): Promise<MessageServiceResult> {
  const providerId = target.providerId;
  const providerModel = normalizeFallbackModel(target);
  const provider = runtime.providers().get(providerId);
  const displayTarget = `${providerId}/${providerModel}`;

  if (!provider) {
    const message = `Model chain ${fallback.name}: provider "${providerId}" is not enabled or configured.`;
    logger.error("proxy", `✗ ${fallback.slug} → ${displayTarget} disabled`);
    recordRequest(providerId, Date.now() - started, message);
    recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId,
      providerModel,
      inputTokens: 0,
      latencyMs: Date.now() - started,
      status: "error",
      error: message,
    });
    return {
      kind: "error",
      status: 404,
      body: anthropicError("not_found_error", message),
    };
  }

  const { req: providerReq, stats: tokenSaverStats } = applyTokenSavers(
    {
      ...cloneMessagesRequest(req),
      model: providerModel,
    },
    getSessionConfig(sessionId) ?? runtime.currentConfig(),
  );
  const inputTokens = countRequestTokens(providerReq);
  const currentConfig = getSessionConfig(sessionId) ?? runtime.currentConfig();
  const result = await limitedProviderStream(
    providerId,
    currentConfig.providers[providerId],
    abortSignal,
    () =>
      provider.streamResponse(providerReq, inputTokens, {
        requestTimeoutMs: fallback.requestTimeoutMs ?? defaultRequestTimeoutMs(providerId),
        streamTotalTimeoutMs:
          fallback.streamTotalTimeoutMs ?? defaultStreamTotalTimeoutMs(providerId),
        abortSignal,
      }),
  );
  const latency = Date.now() - started;

  if (result.error) {
    const errType = providerErrorType(result.error.status);
    const status = providerErrorStatus(result.error.status);
    const error = `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`;
    logWarnings(providerId, providerModel, result.warnings);
    logger.warn(
      "proxy",
      `↷ ${fallback.slug} ${index + 1}/${fallback.models.length} attempt ${attempt} failed: ${displayTarget} ${error}`,
    );
    recordRequest(providerId, latency, error);
    recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId,
      providerModel,
      inputTokens,
      latencyMs: latency,
      status: "error",
      error,
      requestPreview: result.requestPreview,
      warnings: result.warnings,
    });
    return {
      kind: "error",
      status,
      body: anthropicError(
        errType,
        `Model chain ${fallback.name}: ${displayTarget} (${result.error.status}): ${result.error.message}`,
      ),
    };
  }

  if (!result.stream) {
    const message = `Model chain ${fallback.name}: ${displayTarget} returned an empty stream`;
    logger.warn(
      "proxy",
      `↷ ${fallback.slug} ${index + 1}/${fallback.models.length} attempt ${attempt} failed: ${displayTarget} empty stream`,
    );
    recordRequest(providerId, latency, message);
    recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId,
      providerModel,
      inputTokens,
      latencyMs: latency,
      status: "error",
      error: message,
      requestPreview: result.requestPreview,
      warnings: result.warnings,
    });
    return {
      kind: "error",
      status: 500,
      body: anthropicError("api_error", message),
    };
  }

  const idleTimeoutMs = streamIdleTimeoutMsFor(providerId, fallback);
  const probe = await probeStreamForUsefulAnthropicContent(result.stream, idleTimeoutMs);
  if (!probe.ok) {
    const status: ErrorStatus = 500;
    const errType = providerErrorType(status);
    const message = `Model chain ${fallback.name}: ${displayTarget} stream produced no useful content: ${probe.reason}`;
    logger.warn(
      "proxy",
      `↷ ${fallback.slug} ${index + 1}/${fallback.models.length} attempt ${attempt} failed: ${displayTarget} ${probe.reason}`,
    );
    recordRequest(providerId, latency, message);
    recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId,
      providerModel,
      inputTokens,
      latencyMs: latency,
      status: "error",
      error: message,
      requestPreview: result.requestPreview,
      warnings: result.warnings,
    });
    return {
      kind: "error",
      status,
      body: anthropicError(errType, message),
    };
  }

  logger.info(
    "proxy",
    `→ ${fallback.slug} used ${displayTarget} (${inputTokens} input tokens, ${latency}ms to first byte)`,
  );
  logWarnings(providerId, providerModel, result.warnings);
  recordRequest(providerId, latency, null);
  if (getSessionPrimaryModel(sessionId)?.providerId !== "fallback") {
    setSessionPrimaryModel(sessionId, providerId, providerModel);
  }
  const prompt = serializePrompt(providerReq, isFirstSessionRequest(sessionId));
  const logEntryId = recordSessionRequest(sessionId, {
    requestedModel: req.model,
    providerId,
    providerModel,
    inputTokens,
    latencyMs: latency,
    status: "ok",
    error: null,
    prompt,
    requestPreview: result.requestPreview,
    warnings: result.warnings,
    tokenSavers: tokenSaverStats,
  });
  return streamResultWithCapture(probe.stream, logEntryId);
}

function normalizeFallbackModel(target: ModelFallbackEntry): string {
  let model = target.model;
  if (model.startsWith("anthropic/")) model = model.slice("anthropic/".length);
  if (model.startsWith(`${target.providerId}/`)) model = model.slice(target.providerId.length + 1);
  return model;
}

function streamIdleTimeoutMsFor(providerId: string, fallback: ModelFallbackConfig): number {
  return fallback.streamIdleTimeoutMs ?? defaultStreamIdleTimeoutMs(providerId);
}
