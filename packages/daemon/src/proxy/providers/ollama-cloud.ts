import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class OllamaCloudProvider extends AnthropicMessagesTransport {
  get id() {
    return "ollama_cloud";
  }
  get label() {
    return "Ollama Cloud";
  }

  protected override baseUrl(): string {
    const url = (this.config.baseUrl ?? "https://ollama.com").replace(/\/$/, "");
    return url.endsWith("/v1") ? url : `${url}/v1`;
  }
}
