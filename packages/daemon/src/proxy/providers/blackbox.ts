import { OpenAIChatTransport } from "./transport-openai.js";

export class BlackboxProvider extends OpenAIChatTransport {
  get id() {
    return "blackbox";
  }
  get label() {
    return "Blackbox AI";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "blackbox") return parts.slice(1).join("/");
    return requestedModel;
  }
}
