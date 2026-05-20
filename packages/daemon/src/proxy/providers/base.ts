import type { ProviderConfig } from "../../config/schema.js";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";

export interface StreamResult {
  stream?: ReadableStream<string>;
  error?: { status: number; message: string };
}

export abstract class BaseProvider {
  constructor(protected readonly config: ProviderConfig) {}

  abstract get id(): string;
  abstract get label(): string;

  abstract streamResponse(req: MessagesRequest, inputTokens: number): Promise<StreamResult>;
  abstract listModels(): Promise<ModelInfo[]>;

  async listEnabledModels(): Promise<ModelInfo[]> {
    const all = await this.listModels();
    const disabled = new Set(this.config.disabledModels ?? []);
    return disabled.size === 0 ? all : all.filter((m) => !disabled.has(m.id));
  }

  async testConnection(): Promise<{
    ok: boolean;
    latencyMs: number;
    modelCount?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const models = await this.listEnabledModels();
      const latencyMs = Date.now() - start;
      if (models.length === 0) {
        return { ok: false, latencyMs, error: "Nenhum modelo retornado pelo provider" };
      }
      return { ok: true, latencyMs, modelCount: models.length };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected baseUrl(): string {
    return this.config.baseUrl ?? "";
  }

  protected authHeader(): string {
    return `Bearer ${this.config.apiKey ?? ""}`;
  }

  protected requiresApiKey(): boolean {
    return true;
  }

  protected hasApiKey(): boolean {
    return !!this.config.apiKey?.trim();
  }

  protected missingApiKeyMessage(): string {
    return `${this.label} API key is missing. Save the API key in Providers before using ${this.id}.`;
  }

  protected requestTimeoutMs(): number | undefined {
    return this.config.requestTimeoutMs;
  }
}
