import { OpenAIChatTransport } from "./transport-openai.js";

export class KimiProvider extends OpenAIChatTransport {
  get id() {
    return "kimi";
  }
  get label() {
    return "Kimi (Moonshot)";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "kimi") return parts.slice(1).join("/");
    return requestedModel;
  }
}
