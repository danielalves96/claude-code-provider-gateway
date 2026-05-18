import { OpenAIChatTransport } from "./transport-openai.js";

export class XAIProvider extends OpenAIChatTransport {
  get id() {
    return "xai";
  }
  get label() {
    return "xAI (Grok)";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "xai") return parts.slice(1).join("/");
    return requestedModel;
  }
}
