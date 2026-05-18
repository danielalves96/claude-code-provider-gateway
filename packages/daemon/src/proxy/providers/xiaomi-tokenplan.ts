import { OpenAIChatTransport } from "./transport-openai.js";

export class XiaomiTokenPlanProvider extends OpenAIChatTransport {
  get id() {
    return "xiaomi_tokenplan";
  }
  get label() {
    return "Xiaomi MiMo (Token Plan)";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "xiaomi_tokenplan") return parts.slice(1).join("/");
    return requestedModel;
  }
}
