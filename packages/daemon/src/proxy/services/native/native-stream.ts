import {
  defaultStreamIdleTimeoutMs,
  defaultStreamTotalTimeoutMs,
  type Config,
} from "../../../config/schema.js";
import { countRequestTokens } from "../../../core/anthropic/tokens.js";
import type { MessagesRequest } from "../../../core/anthropic/types.js";
import { logger } from "../../../observability/log.js";
import { isFirstSessionRequest, recordSessionRequest } from "../../../runtime/sessions/index.js";
import { recordRequest } from "../../../runtime/provider-stats.js";
import { anthropicError, providerErrorStatus, providerErrorType } from "../../core/index.js";
import { streamAnthropicNative } from "../../providers/index.js";
import { cloneMessagesRequest } from "../../token-savers/index.js";
import { serializePrompt } from "../shared/prompt-serializer.js";
import { logWarnings, safeProviderStream } from "../streaming/provider-stream.js";
import { streamResultWithCapture } from "../streaming/stream-result.js";
import { applyTokenSavers } from "../shared/token-saver-pipeline.js";
import type { MessageServiceResult } from "../shared/types.js";

const NATIVE_PROVIDER_ID = "anthropic_native";

export async function streamNativeClaude(
  req: MessagesRequest,
  started: number,
  sessionId: string | null | undefined,
  config: Config,
  abortSignal?: AbortSignal,
): Promise<MessageServiceResult> {
  const { req: nativeReq, stats: tokenSaverStats } = applyTokenSavers(
    cloneMessagesRequest(req),
    config,
  );
  const inputTokens = countRequestTokens(nativeReq);
  const result = await safeProviderStream(() =>
    streamAnthropicNative(
      nativeReq,
      nativeReq.model,
      defaultStreamTotalTimeoutMs(NATIVE_PROVIDER_ID),
      defaultStreamIdleTimeoutMs(NATIVE_PROVIDER_ID),
      defaultStreamTotalTimeoutMs(NATIVE_PROVIDER_ID),
      abortSignal,
    ),
  );
  const latency = Date.now() - started;

  if (result.error) {
    const errType = providerErrorType(result.error.status);
    const status = providerErrorStatus(result.error.status);
    logWarnings(NATIVE_PROVIDER_ID, req.model, result.warnings);
    logger.error(
      "proxy",
      `✗ ${NATIVE_PROVIDER_ID}/${req.model} HTTP ${result.error.status} (${latency}ms)`,
    );
    recordRequest(
      NATIVE_PROVIDER_ID,
      latency,
      `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`,
    );
    recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId: NATIVE_PROVIDER_ID,
      providerModel: req.model,
      inputTokens,
      latencyMs: latency,
      status: "error",
      error: `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`,
      requestPreview: result.requestPreview,
      warnings: result.warnings,
    });
    return {
      kind: "error",
      status,
      body: anthropicError(
        errType,
        `Anthropic native (${result.error.status}): ${result.error.message}`,
      ),
    };
  }

  logger.info(
    "proxy",
    `→ ${NATIVE_PROVIDER_ID}/${req.model} (${inputTokens} input tokens, ${latency}ms to first byte)`,
  );
  recordRequest(NATIVE_PROVIDER_ID, latency, null);
  const prompt = serializePrompt(nativeReq, isFirstSessionRequest(sessionId));
  const logEntryId = recordSessionRequest(sessionId, {
    requestedModel: req.model,
    providerId: NATIVE_PROVIDER_ID,
    providerModel: req.model,
    inputTokens,
    latencyMs: latency,
    status: "ok",
    error: null,
    prompt,
    requestPreview: result.requestPreview,
    warnings: result.warnings,
    tokenSavers: tokenSaverStats,
  });
  return streamResultWithCapture(result.stream, logEntryId);
}
