import { randomUUID } from "node:crypto";
import { saveConfig } from "../../config/index.js";
import type { Config, ProviderConfig } from "../../config/schema.js";
import { anthropicToOpenAI } from "../../core/anthropic/conversion.js";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import { postProviderStream } from "./api-client.js";
import { BaseProvider, type ProviderRequestOptions, type StreamResult } from "./base.js";
import {
  copilotEditorHeaders,
  exchangeForCopilotToken,
  isCopilotLoggedIn,
  shouldRefreshCopilotToken,
} from "./copilot-auth.js";
import { listCopilotModels, toCopilotModelInfo } from "./copilot-catalog.js";
import { transformCopilotChatStream } from "./copilot-chat-stream.js";
import { streamCopilotNativeAnthropic } from "./copilot-native-anthropic.js";
import { stripGatewayProviderPrefix } from "./model-prefix.js";

export class CopilotProvider extends BaseProvider {
  constructor(
    config: ProviderConfig,
    private readonly rootConfig: Config,
  ) {
    super(config);
  }

  get id() {
    return "copilot";
  }
  get label() {
    return "GitHub Copilot";
  }

  async streamResponse(
    req: MessagesRequest,
    inputTokens: number,
    options?: ProviderRequestOptions,
  ): Promise<StreamResult> {
    try {
      await this.ensureFreshCopilotToken();
    } catch (err) {
      return { error: { status: 401, message: err instanceof Error ? err.message : String(err) } };
    }

    const providerModel = this.resolveModel(req.model);

    // Native Anthropic protocol on Copilot for claude-* models — preserves
    // tool_use / thinking / citation blocks instead of round-tripping through
    // OpenAI Chat Completions. Avoids fidelity loss for our biggest target
    // (Claude Code talking to Claude through Copilot).
    if (providerModel.startsWith("claude-")) {
      return streamCopilotNativeAnthropic({
        req,
        providerModel,
        endpoint: this.endpoint(),
        headers: this.copilotHeaders(),
        timeoutMs: this.requestTimeoutMs(options),
        streamIdleTimeoutMs: this.streamIdleTimeoutMs(options),
        streamTotalTimeoutMs: this.streamTotalTimeoutMs(options),
        abortSignal: options?.abortSignal,
      });
    }

    const openaiReq = anthropicToOpenAI(req, providerModel);

    const result = await postProviderStream({
      url: `${this.endpoint()}/chat/completions`,
      headers: this.copilotHeaders(),
      body: openaiReq,
      timeoutMs: this.requestTimeoutMs(options),
      streamIdleTimeoutMs: this.streamIdleTimeoutMs(options),
      streamTotalTimeoutMs: this.streamTotalTimeoutMs(options),
      abortSignal: options?.abortSignal,
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    return { stream: transformCopilotChatStream(result.body, messageId, req.model, inputTokens) };
  }

  async listModels(): Promise<ModelInfo[]> {
    await this.ensureFreshCopilotToken();
    const oauth = this.config.oauth!;
    const models = await listCopilotModels(oauth.copilotToken!, this.endpoint());
    return models.map(toCopilotModelInfo);
  }

  override async testConnection(): Promise<{
    ok: boolean;
    latencyMs: number;
    modelCount?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.ensureFreshCopilotToken();
      const models = await this.listEnabledModels();
      return { ok: true, latencyMs: Date.now() - start, modelCount: models.length };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async ensureFreshCopilotToken(): Promise<void> {
    if (!isCopilotLoggedIn(this.config.oauth)) {
      throw new Error("GitHub Copilot is not logged in");
    }
    if (!shouldRefreshCopilotToken(this.config.oauth)) return;

    const exchanged = await exchangeForCopilotToken(this.config.oauth!.accessToken!);
    this.config.oauth = {
      ...this.config.oauth,
      copilotToken: exchanged.token,
      copilotExpiresAt: exchanged.expiresAt,
      copilotEndpoint: exchanged.endpoint,
    };
    this.config.authType = "oauth";
    this.config.enabled = true;
    saveConfig(this.rootConfig);
  }

  private endpoint(): string {
    return (
      this.config.oauth?.copilotEndpoint ??
      this.config.baseUrl ??
      "https://api.individual.githubcopilot.com"
    ).replace(/\/$/, "");
  }

  private copilotHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${this.config.oauth?.copilotToken ?? ""}`,
      ...copilotEditorHeaders(),
    };
  }

  private resolveModel(requestedModel: string): string {
    return stripGatewayProviderPrefix(requestedModel, this.id);
  }
}
