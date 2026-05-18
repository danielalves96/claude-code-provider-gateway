import { OpenAIChatTransport } from "./transport-openai.js";

export class FireworksProvider extends OpenAIChatTransport {
  get id() {
    return "fireworks";
  }
  get label() {
    return "Fireworks AI";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "fireworks") return parts.slice(1).join("/");
    return requestedModel;
  }
}
