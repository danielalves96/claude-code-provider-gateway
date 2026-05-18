import { OpenAIChatTransport } from "./transport-openai.js";

export class AlicodeIntlProvider extends OpenAIChatTransport {
  get id() {
    return "alicode_intl";
  }
  get label() {
    return "Alibaba Bailian (Intl)";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "alicode_intl") return parts.slice(1).join("/");
    return requestedModel;
  }
}
