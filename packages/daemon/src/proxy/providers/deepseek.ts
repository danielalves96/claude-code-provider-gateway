import type { ModelInfo } from "../../core/anthropic/types.js";
import { fetchProviderJson, mapProviderModels } from "./api-client.js";
import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class DeepSeekProvider extends AnthropicMessagesTransport {
  get id() {
    return "deepseek";
  }
  get label() {
    return "DeepSeek";
  }

  override async listModels(): Promise<ModelInfo[]> {
    const url = this.baseUrl().replace(/\/anthropic\/?$/, "") + "/models";
    const json = await fetchProviderJson<{ data?: Array<{ id: string; created?: number }> }>({
      url,
      headers: { Authorization: this.authHeader() },
      timeoutMs: this.requestTimeoutMs(),
    });
    return mapProviderModels(json.data ?? [], this.id, this.label);
  }
}
