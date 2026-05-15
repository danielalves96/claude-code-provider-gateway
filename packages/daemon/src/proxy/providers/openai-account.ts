import { randomUUID } from "node:crypto";
import { saveConfig } from "../../config/index.js";
import type { Config, ProviderConfig } from "../../config/schema.js";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import { postProviderStream } from "./api-client.js";
import { BaseProvider, type StreamResult } from "./base.js";
import { stripGatewayProviderPrefix } from "./model-prefix.js";
import { isOAuthReady, refreshAccessToken, shouldRefresh } from "./openai-account-auth.js";
import { listOpenAIAccountModels, toModelInfo } from "./openai-account-catalog.js";
import { buildOpenAIAccountResponsesRequest } from "./openai-account-responses.js";
import { transformOpenAIAccountResponsesStream } from "./openai-account-stream.js";

export class OpenAIAccountProvider extends BaseProvider {
  constructor(
    config: ProviderConfig,
    private readonly rootConfig: Config,
  ) {
    super(config);
  }

  get id() {
    return "openai_account";
  }
  get label() {
    return "OpenAI Account";
  }

  async streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult> {
    try {
      await this.ensureFreshToken();
    } catch (err) {
      return { error: { status: 401, message: err instanceof Error ? err.message : String(err) } };
    }

    const model = this.resolveModel(req.model);
    const result = await postProviderStream({
      url: `${this.baseUrl()}/codex/responses`,
      headers: this.codexHeaders(),
      body: await buildOpenAIAccountResponsesRequest(req, model),
      timeoutMs: this.requestTimeoutMs(),
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    return {
      stream: transformOpenAIAccountResponsesStream(result.body, messageId, req.model, inputTokens),
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return (await listOpenAIAccountModels(this.config.models)).map(toModelInfo);
  }

  override async testConnection(): Promise<{
    ok: boolean;
    latencyMs: number;
    modelCount?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.ensureFreshToken();
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

  private async ensureFreshToken(): Promise<void> {
    if (!isOAuthReady(this.config.oauth)) {
      throw new Error("OpenAI Account is not logged in");
    }
    if (!shouldRefresh(this.config.oauth)) return;

    const refreshed = await refreshAccessToken(this.config.oauth!.refreshToken!);
    this.config.oauth = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      accountId: refreshed.accountId ?? this.config.oauth?.accountId,
      planType: refreshed.planType ?? this.config.oauth?.planType,
    };
    this.config.authType = "oauth";
    this.config.enabled = true;
    saveConfig(this.rootConfig);
  }

  private codexHeaders(): Record<string, string> {
    const oauth = this.config.oauth;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauth?.accessToken ?? ""}`,
      "OpenAI-Beta": "responses=experimental",
      "chatgpt-account-id": oauth?.accountId ?? "",
      originator: "codex_cli_rs",
      Accept: "text/event-stream",
    };
  }

  private resolveModel(requestedModel: string): string {
    return stripGatewayProviderPrefix(requestedModel, this.id);
  }
}
