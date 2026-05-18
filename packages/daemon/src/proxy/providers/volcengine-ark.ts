import { OpenAIChatTransport } from "./transport-openai.js";

export class VolcengineArkProvider extends OpenAIChatTransport {
  get id() {
    return "volcengine_ark";
  }
  get label() {
    return "Volcengine Ark";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "volcengine_ark") return parts.slice(1).join("/");
    return requestedModel;
  }
}
