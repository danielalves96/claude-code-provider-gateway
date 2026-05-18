import { OpenAIChatTransport } from "./transport-openai.js";

export class CerebrasProvider extends OpenAIChatTransport {
  get id() {
    return "cerebras";
  }
  get label() {
    return "Cerebras";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "cerebras") return parts.slice(1).join("/");
    return requestedModel;
  }
}
