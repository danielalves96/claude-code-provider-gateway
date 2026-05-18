import { OpenAIChatTransport } from "./transport-openai.js";

export class CohereProvider extends OpenAIChatTransport {
  get id() {
    return "cohere";
  }
  get label() {
    return "Cohere";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "cohere") return parts.slice(1).join("/");
    return requestedModel;
  }
}
