import type { Config, ModelFallbackConfig, ModelFallbackEntry } from "../../config/schema.js";
import { countRequestTokens } from "../../core/anthropic/tokens.js";
import type { MessagesRequest } from "../../core/anthropic/types.js";
import { logger } from "../../observability/log.js";
import type { TokenSaverStats } from "../../runtime/session-types.js";
import {
  getSessionConfig,
  getSessionPrimaryModel,
  isFirstSessionRequest,
  recordSessionRequest,
  setSessionPrimaryModel,
} from "../../runtime/sessions.js";
import { recordRequest } from "../../runtime/stats.js";
import type { AnthropicErrorResponse, ErrorStatus } from "../errors.js";
import { anthropicError, providerErrorStatus, providerErrorType } from "../errors.js";
import { resolveModel } from "../model-router.js";
import { tryOptimize } from "../optimizations.js";
import {
  getAnthropicCredentialsStatus,
  streamAnthropicNative,
} from "../providers/anthropic-passthrough.js";
import type { ProxyRuntime } from "../runtime.js";
import { injectCaveman } from "../token-savers/caveman.js";
import { cloneMessagesRequest, compressMessages, formatRtkLog } from "../token-savers/rtk.js";
import { serializePrompt } from "./prompt-serializer.js";
import { streamResult, streamResultWithCapture } from "./stream-result.js";

export { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";

import { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";

const FALLBACK_ATTEMPTS_PER_MODEL = 2;

export type MessageServiceResult =
  | {
      kind: "stream";
      status: 200;
      stream: ReadableStream<string>;
      headers: HeadersInit;
    }
  | {
      kind: "error";
      status: ErrorStatus;
      body: AnthropicErrorResponse;
    };

export class MessageService {
  constructor(private readonly runtime: ProxyRuntime) {}

  async createMessage(
    req: MessagesRequest,
    sessionId?: string | null,
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
      return await this.streamFallback(req, resolved.fallback, started, sessionId);
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
          if (fallback) return await this.streamFallback(req, fallback, started, sessionId);
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
      return await this.streamNativeClaude(req, started, sessionId, config);
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

    const { req: providerReq, stats: tokenSaverStats } = this.applyTokenSavers(
      {
        ...cloneMessagesRequest(req),
        model: providerModel,
      },
      config,
    );
    const inputTokens = countRequestTokens(providerReq);
    const result = await provider.streamResponse(providerReq, inputTokens);
    const latency = Date.now() - started;

    if (result.error) {
      const errType = providerErrorType(result.error.status);
      const status = providerErrorStatus(result.error.status);
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
      tokenSavers: tokenSaverStats,
    });
    return streamResultWithCapture(result.stream, logEntryId);
  }

  private async streamNativeClaude(
    req: MessagesRequest,
    started: number,
    sessionId: string | null | undefined,
    config: Config,
  ): Promise<MessageServiceResult> {
    const { req: nativeReq, stats: tokenSaverStats } = this.applyTokenSavers(
      cloneMessagesRequest(req),
      config,
    );
    const inputTokens = countRequestTokens(nativeReq);
    const result = await streamAnthropicNative(nativeReq, nativeReq.model, undefined);
    const latency = Date.now() - started;
    // Synthetic stats key so the dashboard can show native Claude usage separately
    // from configured third-party providers.
    const providerId = "anthropic_native";

    if (result.error) {
      const errType = providerErrorType(result.error.status);
      const status = providerErrorStatus(result.error.status);
      logger.error(
        "proxy",
        `✗ ${providerId}/${req.model} HTTP ${result.error.status} (${latency}ms)`,
      );
      recordRequest(
        providerId,
        latency,
        `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`,
      );
      recordSessionRequest(sessionId, {
        requestedModel: req.model,
        providerId,
        providerModel: req.model,
        inputTokens,
        latencyMs: latency,
        status: "error",
        error: `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`,
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
      `→ ${providerId}/${req.model} (${inputTokens} input tokens, ${latency}ms to first byte)`,
    );
    recordRequest(providerId, latency, null);
    const prompt = serializePrompt(nativeReq, isFirstSessionRequest(sessionId));
    const logEntryId = recordSessionRequest(sessionId, {
      requestedModel: req.model,
      providerId,
      providerModel: req.model,
      inputTokens,
      latencyMs: latency,
      status: "ok",
      error: null,
      prompt,
      tokenSavers: tokenSaverStats,
    });
    return streamResultWithCapture(result.stream, logEntryId);
  }

  private async streamFallback(
    req: MessagesRequest,
    fallback: ModelFallbackConfig,
    started: number,
    sessionId: string | null | undefined,
  ): Promise<MessageServiceResult> {
    let lastError: {
      status: ErrorStatus;
      message: string;
      type: ReturnType<typeof providerErrorType>;
    } | null = null;

    for (let index = 0; index < fallback.models.length; index++) {
      const target = fallback.models[index];
      for (let attempt = 1; attempt <= FALLBACK_ATTEMPTS_PER_MODEL; attempt++) {
        const result = await this.tryFallbackTarget(
          req,
          fallback,
          target,
          index,
          attempt,
          started,
          sessionId,
        );
        if (result.kind === "stream") return result;
        lastError = {
          status: result.status,
          message: result.body.error.message,
          type: result.body.error.type as ReturnType<typeof providerErrorType>,
        };
        if (attempt < FALLBACK_ATTEMPTS_PER_MODEL && shouldRetryFallbackResult(result)) {
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

  private async tryFallbackTarget(
    req: MessagesRequest,
    fallback: ModelFallbackConfig,
    target: ModelFallbackEntry,
    index: number,
    attempt: number,
    started: number,
    sessionId: string | null | undefined,
  ): Promise<MessageServiceResult> {
    const providerId = target.providerId;
    const providerModel = normalizeFallbackModel(target);
    const provider = this.runtime.providers().get(providerId);
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

    const { req: providerReq, stats: tokenSaverStats } = this.applyTokenSavers(
      {
        ...cloneMessagesRequest(req),
        model: providerModel,
      },
      getSessionConfig(sessionId) ?? this.runtime.currentConfig(),
    );
    const inputTokens = countRequestTokens(providerReq);
    const result = await provider.streamResponse(providerReq, inputTokens);
    const latency = Date.now() - started;

    if (result.error) {
      const errType = providerErrorType(result.error.status);
      const status = providerErrorStatus(result.error.status);
      const error = `HTTP ${result.error.status}: ${result.error.message.slice(0, 200)}`;
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

    logger.info(
      "proxy",
      `→ ${fallback.slug} used ${displayTarget} (${inputTokens} input tokens, ${latency}ms to first byte)`,
    );
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
      tokenSavers: tokenSaverStats,
    });
    return streamResultWithCapture(result.stream, logEntryId);
  }

  countTokens(req: MessagesRequest, sessionId?: string | null): number {
    const { req: transformed } = this.applyTokenSavers(
      cloneMessagesRequest(req),
      getSessionConfig(sessionId) ?? this.runtime.currentConfig(),
    );
    return countRequestTokens(transformed);
  }

  private applyTokenSavers(
    req: MessagesRequest,
    config: Config,
  ): {
    req: MessagesRequest;
    stats: TokenSaverStats | undefined;
  } {
    const { tokenSavers } = config;
    const rtkStats = compressMessages(req, tokenSavers.rtkEnabled);
    const rtkLine = formatRtkLog(rtkStats);
    if (rtkLine) logger.info("rtk", rtkLine);

    injectCaveman(req, tokenSavers.cavemanEnabled, tokenSavers.cavemanLevel);
    if (tokenSavers.cavemanEnabled) {
      logger.info("caveman", `system prompt injected (${tokenSavers.cavemanLevel})`);
    }

    if (!rtkStats && !tokenSavers.cavemanEnabled) return { req, stats: undefined };

    const stats: TokenSaverStats = {
      rtkBytesBefore: rtkStats?.bytesBefore ?? 0,
      rtkBytesAfter: rtkStats?.bytesAfter ?? 0,
      rtkHits: rtkStats?.hits.length ?? 0,
      rtkFilters: rtkStats ? Array.from(new Set(rtkStats.hits.map((hit) => hit.filter))) : [],
      cavemanLevel: tokenSavers.cavemanEnabled ? tokenSavers.cavemanLevel : null,
    };
    return { req, stats };
  }
}

function normalizeFallbackModel(target: ModelFallbackEntry): string {
  let model = target.model;
  if (model.startsWith("anthropic/")) model = model.slice("anthropic/".length);
  if (model.startsWith(`${target.providerId}/`)) model = model.slice(target.providerId.length + 1);
  return model;
}

function shouldRetryFallbackResult(result: MessageServiceResult): boolean {
  return result.kind === "error" && (result.status === 429 || result.status === 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
