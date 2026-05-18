import { OpenAIChatTransport } from "./transport-openai.js";

export class MistralProvider extends OpenAIChatTransport {
  get id() {
    return "mistral";
  }
  get label() {
    return "Mistral";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "mistral") return parts.slice(1).join("/");
    return requestedModel;
  }
}
