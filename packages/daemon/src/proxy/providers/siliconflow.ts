import { OpenAIChatTransport } from "./transport-openai.js";

export class SiliconFlowProvider extends OpenAIChatTransport {
  get id() {
    return "siliconflow";
  }
  get label() {
    return "SiliconFlow";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "siliconflow") return parts.slice(1).join("/");
    return requestedModel;
  }
}
