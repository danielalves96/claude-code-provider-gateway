import { countRequestTokens } from "../../core/anthropic/tokens.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { logger } from "../../observability/log.js";
import {
  getSessionConfig,
  getSessionPrimaryModel,
  isFirstSessionRequest,
  recordSessionRequest,
  setSessionPrimaryModel,
} from "../../runtime/sessions.js";
import { recordRequest } from "../../runtime/stats.js";
import { anthropicError, providerErrorStatus, providerErrorType } from "../errors.js";
import { resolveModel } from "../model-router.js";
import { tryOptimize } from "../optimizations.js";
import { getAnthropicCredentialsStatus } from "../providers/anthropic-passthrough.js";
import type { ProxyRuntime } from "../runtime.js";
import { cloneMessagesRequest } from "../token-savers/rtk.js";
import { streamFallback } from "./fallback-stream.js";
import { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";
import { streamNativeClaude } from "./native-stream.js";
import { limitedProviderStream, logWarnings } from "./provider-stream.js";
import { serializePrompt } from "./prompt-serializer.js";
import { streamResult, streamResultWithCapture } from "./stream-result.js";
import { applyTokenSavers } from "./token-saver-pipeline.js";
import type { MessageServiceResult } from "./types.js";

export type { MessageServiceResult } from "./types.js";
export { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";

export class MessageService {
  constructor(private readonly runtime: ProxyRuntime) {}

  async createMessage(
    req: MessagesRequest,
    sessionId?: string | null,
    abortSignal?: AbortSignal,
  ): Promise<MessageServiceResult> {
    const started = Date.now();
    const config = getSessionConfig(sessionId) ?? this.runtime.currentConfig();
    const isClaudeTierRequest = /^claude-/i.test(req.model);
    const optimized = isClaudeTierRequest ? { handled: false as const } : tryOptimize(req);

    if (optimized.handled) {
      const latency = Date.now() - started;
      logger.info("proxy", `→ local optimization for ${req.model} (${latency}ms)`);
      const resolved = resolveModel(req.model, config);
      if (resolved.source === "prefix") {
        setSessionPrimaryModel(sessionId, resolved.providerId, resolved.providerModel);
      }
      const inputTokens = countRequestTokens(req);
      const prompt = serializePrompt(req, isFirstSessionRequest(sessionId));
      recordSessionRequest(sessionId, {
        requestedModel: req.model,
        providerId: "local",
        providerModel: req.model,
        inputTokens,
        latencyMs: latency,
        status: "ok",
        error: null,
        prompt,
      });
      return streamResult(optimized.stream);
    }

    const registry = this.runtime.providers();

    const resolved = resolveModel(req.model, config);
    if (resolved.source === "fallback") {
      setSessionPrimaryModel(sessionId, "fallback", resolved.fallback.slug);
      return await streamFallback(this.runtime, req, resolved.fallback, started, sessionId, abortSignal);
    }

    let { providerId, providerModel } = resolved;

    // When the user explicitly picks a model via provider prefix (e.g. anthropic/copilot/gemini-2.5-pro),
    // remember it as the session's primary model so background Claude Code calls get routed there too.
    if (resolved.source === "prefix") {
      setSessionPrimaryModel(sessionId, providerId, providerModel);
    }

    // Background calls from Claude Code (claude-haiku-*, claude-sonnet-*, etc.) arrive without a
    // provider prefix and fall through to passthrough. Redirect them to the session's primary
    // model so they use whatever the user is actually running instead of a hardcoded Claude
    // model name.
    if (resolved.source === "passthrough" && isClaudeTierRequest) {
      const primary = getSessionPrimaryModel(sessionId);
      if (primary) {
        if (primary.providerId === "fallback") {
          const fallback = config.modelFallbacks.find(
            (candidate) =>
              candidate.enabled &&
              candidate.slug === primary.providerModel &&
              candidate.models.length > 0,
          );
          if (fallback) {
            return await streamFallback(this.runtime, req, fallback, started, sessionId, abortSignal);
          }
          const message = `Model chain "${primary.providerModel}" is not enabled or configured.`;
          logger.error("proxy", `✗ ${req.model} → fallback/${primary.providerModel} unavailable`);
          recordRequest("fallback", Date.now() - started, message);
          recordSessionRequest(sessionId, {
            requestedModel: req.model,
            providerId: "fallback",
            providerModel: primary.providerModel,
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
        providerId = primary.providerId as typeof providerId;
        providerModel = primary.providerModel;
      }
    }

    const primaryModel = getSessionPrimaryModel(sessionId);
    if (
      resolved.source === "passthrough" &&
      providerId === config.activeProvider &&
      providerModel === req.model &&
      shouldUseNativeClaudePassthrough(req.model, config, primaryModel) &&
      getAnthropicCredentialsStatus().available
    ) {
      return await streamNativeClaude(req, started, sessionId, config, abortSignal);
    }

    const provider = registry.get(providerId);

    if (!provider) {
      const message = `Provider "${providerId}" is not enabled or configured.`;
      logger.error("proxy", `✗ ${req.model} → ${providerId} disabled`);
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
      config,
    );
    const inputTokens = countRequestTokens(providerReq);
    const result = await limitedProviderStream(
      providerId,
      config.providers[providerId],
      abortSignal,
      () =>
        provider.streamResponse(providerReq, inputTokens, {
          abortSignal,
        }),
    );
    const latency = Date.now() - started;

    if (result.error) {
      const errType = providerErrorType(result.error.status);
      const status = providerErrorStatus(result.error.status);
      logWarnings(providerId, providerModel, result.warnings);
      logger.error(
        "proxy",
        `✗ ${providerId}/${providerModel} HTTP ${result.error.status} (${latency}ms)`,
      );
      recordRequest(
        providerId,
        latency,
        `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`,
      );
      recordSessionRequest(sessionId, {
        requestedModel: req.model,
        providerId,
        providerModel,
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
          `Provider ${providerId} (${result.error.status}): ${result.error.message}`,
        ),
      };
    }

    logger.info(
      "proxy",
      `→ ${providerId}/${providerModel} (${inputTokens} input tokens, ${latency}ms to first byte)`,
    );
    logWarnings(providerId, providerModel, result.warnings);
    recordRequest(providerId, latency, null);
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
    return streamResultWithCapture(result.stream, logEntryId);
  }

  countTokens(req: MessagesRequest, sessionId?: string | null): number {
    const { req: transformed } = applyTokenSavers(
      cloneMessagesRequest(req),
      getSessionConfig(sessionId) ?? this.runtime.currentConfig(),
    );
    return countRequestTokens(transformed);
  }
}
