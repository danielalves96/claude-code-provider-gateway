import { OpenAIChatTransport } from "./transport-openai.js";

export class NebiusProvider extends OpenAIChatTransport {
  get id() {
    return "nebius";
  }
  get label() {
    return "Nebius AI";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "nebius") return parts.slice(1).join("/");
    return requestedModel;
  }
}
