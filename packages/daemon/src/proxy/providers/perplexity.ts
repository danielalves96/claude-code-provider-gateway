import { OpenAIChatTransport } from "./transport-openai.js";

export class PerplexityProvider extends OpenAIChatTransport {
  get id() {
    return "perplexity";
  }
  get label() {
    return "Perplexity";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "perplexity") return parts.slice(1).join("/");
    return requestedModel;
  }
}
