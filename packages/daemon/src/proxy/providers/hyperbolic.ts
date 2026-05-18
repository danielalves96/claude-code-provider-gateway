import { OpenAIChatTransport } from "./transport-openai.js";

export class HyperbolicProvider extends OpenAIChatTransport {
  get id() {
    return "hyperbolic";
  }
  get label() {
    return "Hyperbolic";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "hyperbolic") return parts.slice(1).join("/");
    return requestedModel;
  }
}
