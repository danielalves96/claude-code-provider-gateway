import { AnthropicMessagesTransport } from "./transport-anthropic.js";

export class GLMProvider extends AnthropicMessagesTransport {
  get id() {
    return "glm";
  }
  get label() {
    return "GLM (Z.AI)";
  }

  protected override resolveModel(model: string): string {
    const parts = model.split("/");
    if (parts[0] === "glm") return parts.slice(1).join("/");
    return model;
  }

  protected override authHeaders(): Record<string, string> {
    return { "x-api-key": this.config.apiKey ?? "" };
  }
}
