import { OpenAIChatTransport } from "./transport-openai.js";

export class AlicodeProvider extends OpenAIChatTransport {
  get id() {
    return "alicode";
  }
  get label() {
    return "Alibaba Bailian";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "alicode") return parts.slice(1).join("/");
    return requestedModel;
  }
}
