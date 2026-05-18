import { OpenAIChatTransport } from "./transport-openai.js";

export class HuggingFaceProvider extends OpenAIChatTransport {
  get id() {
    return "huggingface";
  }
  get label() {
    return "HuggingFace";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "huggingface") return parts.slice(1).join("/");
    return requestedModel;
  }
}
