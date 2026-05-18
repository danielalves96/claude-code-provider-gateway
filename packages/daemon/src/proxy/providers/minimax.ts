import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class MinimaxProvider extends AnthropicMessagesTransport {
  get id() {
    return "minimax";
  }
  get label() {
    return "Minimax";
  }

  protected override resolveModel(model: string): string {
    const parts = model.split("/");
    if (parts[0] === "minimax") return parts.slice(1).join("/");
    return model;
  }

  protected override authHeaders(): Record<string, string> {
    return { "x-api-key": this.config.apiKey ?? "" };
  }
}
