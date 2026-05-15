import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class OpenRouterProvider extends AnthropicMessagesTransport {
  get id() {
    return "openrouter";
  }
  get label() {
    return "OpenRouter";
  }

  protected override extraHeaders(): Record<string, string> {
    return { "HTTP-Referer": "https://github.com/claude-code-provider-gateway" };
  }
}
