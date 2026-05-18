import { OpenAIChatTransport } from "./transport-openai.js";

export class TogetherProvider extends OpenAIChatTransport {
  get id() {
    return "together";
  }
  get label() {
    return "Together AI";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "together") return parts.slice(1).join("/");
    return requestedModel;
  }
}
