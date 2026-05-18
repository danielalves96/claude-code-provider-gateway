import { OpenAIChatTransport } from "./transport-openai.js";

export class BytePlusProvider extends OpenAIChatTransport {
  get id() {
    return "byteplus";
  }
  get label() {
    return "BytePlus ModelArk";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "byteplus") return parts.slice(1).join("/");
    return requestedModel;
  }
}
