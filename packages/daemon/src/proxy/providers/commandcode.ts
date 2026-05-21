import { randomUUID } from "node:crypto";
import type { MessagesRequest, ModelInfo } from "../../core/anthropic/types.js";
import { postProviderStream } from "./api-client.js";
import type { StreamResult } from "./base.js";
import { BaseProvider, type ProviderRequestOptions } from "./base.js";
import { anthropicToCommandCode } from "./commandcode-conversion.js";
import {
  COMMANDCODE_MODELS,
  COMMANDCODE_VERSION,
  DEFAULT_COMMANDCODE_ENDPOINT,
  fetchCommandCodeModelsFromDocs,
  mergeCommandCodeModels,
  stripCommandCodeModelPrefix,
} from "./commandcode-models.js";
import { commandCodeStreamToAnthropic } from "./commandcode-stream.js";

export { anthropicToCommandCode } from "./commandcode-conversion.js";
export { commandCodeStreamToAnthropic } from "./commandcode-stream.js";

export class CommandCodeProvider extends BaseProvider {
  get id() {
    return "commandcode";
  }

  get label() {
    return "Command Code";
  }

  async streamResponse(
    req: MessagesRequest,
    inputTokens: number,
    options?: ProviderRequestOptions,
  ): Promise<StreamResult> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      return { error: { status: 401, message: this.missingApiKeyMessage() } };
    }

    const providerModel = stripCommandCodeModelPrefix(req.model);
    const result = await postProviderStream({
      url: this.endpointUrl(),
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: this.authHeader(),
        "x-command-code-version": COMMANDCODE_VERSION,
        "x-cli-environment": "cli",
        "x-session-id": randomUUID(),
      },
      body: await anthropicToCommandCode(req, providerModel),
      timeoutMs: this.requestTimeoutMs(options),
      streamIdleTimeoutMs: this.streamIdleTimeoutMs(options),
      streamTotalTimeoutMs: this.streamTotalTimeoutMs(options),
      abortSignal: options?.abortSignal,
    });

    if ("error" in result) return { error: result.error };

    const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
    return {
      stream: commandCodeStreamToAnthropic(result.body, {
        messageId,
        model: req.model,
        inputTokens,
      }),
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      throw new Error(this.missingApiKeyMessage());
    }

    const models = await fetchCommandCodeModelsFromDocs().catch(() => [...COMMANDCODE_MODELS]);
    return mergeCommandCodeModels(models, this.config.models ?? []).map((model) => ({
      type: "model" as const,
      id: `anthropic/${this.id}/${model.id}`,
      display_name: `${this.label} · ${model.name}`,
      created_at: new Date(0).toISOString(),
    }));
  }

  protected override baseUrl(): string {
    return this.config.baseUrl?.trim() || DEFAULT_COMMANDCODE_ENDPOINT;
  }

  private endpointUrl(): string {
    return this.baseUrl().replace(/\/$/, "");
  }
}
