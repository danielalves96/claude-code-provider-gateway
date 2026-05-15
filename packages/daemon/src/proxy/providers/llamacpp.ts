import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class LlamaCppProvider extends AnthropicMessagesTransport {
  get id() {
    return "llamacpp";
  }
  get label() {
    return "llama.cpp";
  }

  protected override requiresApiKey(): boolean {
    return false;
  }
}
