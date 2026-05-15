import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class LMStudioProvider extends AnthropicMessagesTransport {
  get id() {
    return "lmstudio";
  }
  get label() {
    return "LM Studio";
  }

  protected override requiresApiKey(): boolean {
    return false;
  }
}
