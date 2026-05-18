// Google AI (Gemini) provider — uses the OpenAI-compatible endpoint
// Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
// Auth: static API key from Google AI Studio (aistudio.google.com)

import type { ModelInfo } from "../../core/anthropic/types.js";
import { fetchProviderJson, mapProviderModels } from "./api-client.js";
import { OpenAIChatTransport } from "./transport-openai.js";

export class GoogleProvider extends OpenAIChatTransport {
  get id() {
    return "google";
  }
  get label() {
    return "Google AI (Gemini)";
  }

  protected resolveModel(requestedModel: string): string {
    // Strip "google/" prefix if routing injected it
    const parts = requestedModel.split("/");
    if (parts[0] === "google") return parts.slice(1).join("/");
    return requestedModel;
  }

  override async listModels(): Promise<ModelInfo[]> {
    if (this.requiresApiKey() && !this.hasApiKey()) {
      throw new Error(this.missingApiKeyMessage());
    }

    // The OpenAI-compat /models endpoint returns the standard {data:[]} shape
    const url = `${this.baseUrl()}/models`;
    const json = await fetchProviderJson<{
      data?: Array<{ id: string; created?: number }>;
    }>({
      url,
      headers: {
        Authorization: this.authHeader(),
        ...this.extraHeaders(),
      },
      timeoutMs: this.requestTimeoutMs(),
    });
    return mapProviderModels(json.data ?? [], this.id, this.label);
  }
}
