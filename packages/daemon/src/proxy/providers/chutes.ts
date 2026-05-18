import { OpenAIChatTransport } from "./transport-openai.js";

export class ChutesProvider extends OpenAIChatTransport {
  get id() {
    return "chutes";
  }
  get label() {
    return "Chutes AI";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "chutes") return parts.slice(1).join("/");
    return requestedModel;
  }
}
