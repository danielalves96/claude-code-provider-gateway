import { saveConfig } from "../../config/index.js";
import type { Config, ProviderConfig } from "../../config/schema.js";
import type { ModelInfo } from "../../core/anthropic/types.js";
import { fetchProviderJson, mapProviderModels } from "./api-client.js";
import {
  buildClineHeaders,
  isClineLoggedIn,
  refreshClineAccessToken,
  shouldRefreshClineToken,
} from "./cline-auth.js";
import { stripGatewayProviderPrefix } from "./model-prefix.js";
import { OpenAIChatTransport } from "./transport-openai.js";

const FALLBACK_CLINE_MODELS = [
  { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
  { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
  { id: "openai/gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { id: "openai/gpt-5.4", name: "GPT-5.4" },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
  { id: "google/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview" },
  { id: "kwaipilot/kat-coder-pro", name: "KAT Coder Pro" },
];

export class ClineProvider extends OpenAIChatTransport {
  constructor(
    config: ProviderConfig,
    private readonly rootConfig: Config,
  ) {
    super(config);
  }

  get id() {
    return "cline";
  }
  get label() {
    return "Cline";
  }

  async streamResponse(...args: Parameters<OpenAIChatTransport["streamResponse"]>) {
    try {
      await this.ensureFreshToken();
    } catch (err) {
      return { error: { status: 401, message: err instanceof Error ? err.message : String(err) } };
    }
    return super.streamResponse(...args);
  }

  async listModels(): Promise<ModelInfo[]> {
    await this.ensureFreshToken();

    try {
      const json = await fetchProviderJson<{
        data?: Array<{ id: string; name?: string; created?: number }>;
      }>({
        url: `${this.baseUrl()}/models`,
        headers: this.extraHeaders(),
        timeoutMs: this.requestTimeoutMs(),
      });
      const models = json.data?.length ? json.data : FALLBACK_CLINE_MODELS;
      return mapProviderModels(models, this.id, this.label);
    } catch (err) {
      if (isAuthError(err)) throw err;
      return mapProviderModels(FALLBACK_CLINE_MODELS, this.id, this.label);
    }
  }

  protected override hasApiKey(): boolean {
    return isClineLoggedIn(this.config.oauth);
  }

  protected override missingApiKeyMessage(): string {
    return `${this.label} is not logged in. Sign in via the Providers page before using ${this.id}.`;
  }

  protected override authHeader(): string {
    return buildClineHeaders(this.config.oauth?.accessToken).Authorization ?? "";
  }

  protected override extraHeaders(): Record<string, string> {
    return buildClineHeaders(this.config.oauth?.accessToken);
  }

  protected override baseUrl(): string {
    return (this.config.baseUrl ?? "https://api.cline.bot/api/v1").replace(/\/$/, "");
  }

  protected resolveModel(requestedModel: string): string {
    return stripGatewayProviderPrefix(requestedModel, this.id);
  }

  private async ensureFreshToken(): Promise<void> {
    if (!isClineLoggedIn(this.config.oauth)) {
      throw new Error("Cline is not logged in");
    }
    if (!shouldRefreshClineToken(this.config.oauth)) return;

    const refreshed = await refreshClineAccessToken(this.config.oauth!.refreshToken!);
    this.config.oauth = {
      ...this.config.oauth,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? this.config.oauth?.refreshToken,
      expiresAt: refreshed.expiresAt ?? this.config.oauth?.expiresAt,
      accountId: refreshed.accountId ?? this.config.oauth?.accountId,
    };
    this.config.authType = "oauth";
    this.config.enabled = true;
    saveConfig(this.rootConfig);
  }
}

function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\bHTTP (401|403)\b/.test(message);
}
