import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class MinimaxCNProvider extends AnthropicMessagesTransport {
  get id() {
    return "minimax_cn";
  }
  get label() {
    return "Minimax (China)";
  }

  protected override resolveModel(model: string): string {
    const parts = model.split("/");
    if (parts[0] === "minimax_cn") return parts.slice(1).join("/");
    return model;
  }

  protected override authHeaders(): Record<string, string> {
    return { "x-api-key": this.config.apiKey ?? "" };
  }
}
