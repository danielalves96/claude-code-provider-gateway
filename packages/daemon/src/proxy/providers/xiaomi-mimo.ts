import { OpenAIChatTransport } from "./transport-openai.js";

export class XiaomiMimoProvider extends OpenAIChatTransport {
  get id() {
    return "xiaomi_mimo";
  }
  get label() {
    return "Xiaomi MiMo";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "xiaomi_mimo") return parts.slice(1).join("/");
    return requestedModel;
  }
}
