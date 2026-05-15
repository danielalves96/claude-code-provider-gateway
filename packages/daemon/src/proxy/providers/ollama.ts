import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class OllamaProvider extends AnthropicMessagesTransport {
  get id() {
    return "ollama";
  }
  get label() {
    return "Ollama";
  }

  protected override baseUrl(): string {
    // Ollama needs the /v1 appended — base config is just host:port
    const url = (this.config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    return url.endsWith("/v1") ? url : `${url}/v1`;
  }

  protected override requiresApiKey(): boolean {
    return false;
  }
}
