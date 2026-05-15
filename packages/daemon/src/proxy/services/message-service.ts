import type { MessagesRequest } from "../../core/anthropic/types.js";
import { countRequestTokens } from "../../core/anthropic/tokens.js";
import { logger } from "../../observability/log.js";
import {
  recordSessionRequest,
  setSessionPrimaryModel,
  getSessionPrimaryModel,
  isFirstSessionRequest,
} from "../../runtime/sessions.js";
import { recordRequest } from "../../runtime/stats.js";
import {
  anthropicError,
  providerErrorStatus,
  providerErrorType,
} from "../errors.js";
import type { AnthropicErrorResponse, ErrorStatus } from "../errors.js";
import { resolveModel } from "../model-router.js";
import {
  getAnthropicCredentialsStatus,
  streamAnthropicNative,
} from "../providers/anthropic-passthrough.js";
import { tryOptimize } from "../optimizations.js";
import type { ProxyRuntime } from "../runtime.js";
import { serializePrompt } from "./prompt-serializer.js";
import { streamResult, streamResultWithCapture } from "./stream-result.js";
import { injectCaveman } from "../token-savers/caveman.js";
import { cloneMessagesRequest, compressMessages, formatRtkLog } from "../token-savers/rtk.js";
import type { TokenSaverStats } from "../../runtime/session-types.js";
export { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";
import { shouldUseNativeClaudePassthrough } from "./native-claude-routing.js";

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

  async createMessage(req: MessagesRequest): Promise<MessageServiceResult> {
    const started = Date.now();
    const isClaudeTierRequest = /^claude-/i.test(req.model);
    const optimized = isClaudeTierRequest
      ? { handled: false as const }
      : tryOptimize(req);

    if (optimized.handled) {
      const latency = Date.now() - started;
      logger.info(
        "proxy",
        `→ local optimization for ${req.model} (${latency}ms)`,
      );
      const resolved = resolveModel(req.model, this.runtime.currentConfig());
      if (resolved.source === "prefix") {
        setSessionPrimaryModel(resolved.providerId, resolved.providerModel);
      }
      const inputTokens = countRequestTokens(req);
      const prompt = serializePrompt(req, isFirstSessionRequest());
      recordSessionRequest({
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

    const config = this.runtime.currentConfig();
    const registry = this.runtime.providers();

    const resolved = resolveModel(req.model, config);
    let { providerId, providerModel } = resolved;

    // When the user explicitly picks a model via provider prefix (e.g. anthropic/copilot/gemini-2.5-pro),
    // remember it as the session's primary model so background Claude Code calls get routed there too.
    if (resolved.source === "prefix") {
      setSessionPrimaryModel(providerId, providerModel);
    }

    // Background calls from Claude Code (claude-haiku-*, claude-sonnet-*, etc.) arrive without a
    // provider prefix and fall through to passthrough. Redirect them to the session's primary
    // model so they use whatever the user is actually running instead of a hardcoded Claude
    // model name.
    if (resolved.source === "passthrough" && isClaudeTierRequest) {
      const primary = getSessionPrimaryModel();
      if (primary) {
        providerId = primary.providerId;
        providerModel = primary.providerModel;
      }
    }

    const primaryModel = getSessionPrimaryModel();
    if (
      resolved.source === "passthrough" &&
      providerId === config.activeProvider &&
      providerModel === req.model &&
      shouldUseNativeClaudePassthrough(req.model, config, primaryModel) &&
      getAnthropicCredentialsStatus().available
    ) {
      return await this.streamNativeClaude(req, started);
    }

    const provider = registry.get(providerId);

    if (!provider) {
      const message = `Provider "${providerId}" is not enabled or configured.`;
      logger.error("proxy", `✗ ${req.model} → ${providerId} disabled`);
      recordRequest(providerId, Date.now() - started, message);
      recordSessionRequest({
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

    const { req: providerReq, stats: tokenSaverStats } = this.applyTokenSavers({ ...cloneMessagesRequest(req), model: providerModel });
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
      recordSessionRequest({
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
    const prompt = serializePrompt(providerReq, isFirstSessionRequest());
    const logEntryId = recordSessionRequest({
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
  ): Promise<MessageServiceResult> {
    const { req: nativeReq, stats: tokenSaverStats } = this.applyTokenSavers(cloneMessagesRequest(req));
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
      recordSessionRequest({
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
    const prompt = serializePrompt(nativeReq, isFirstSessionRequest());
    const logEntryId = recordSessionRequest({
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

  countTokens(req: MessagesRequest): number {
    const { req: transformed } = this.applyTokenSavers(cloneMessagesRequest(req));
    return countRequestTokens(transformed);
  }

  private applyTokenSavers(req: MessagesRequest): { req: MessagesRequest; stats: TokenSaverStats | undefined } {
    const { tokenSavers } = this.runtime.currentConfig();
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
      rtkFilters: rtkStats ? Array.from(new Set(rtkStats.hits.map(hit => hit.filter))) : [],
      cavemanLevel: tokenSavers.cavemanEnabled ? tokenSavers.cavemanLevel : null,
    };
    return { req, stats };
  }
}
