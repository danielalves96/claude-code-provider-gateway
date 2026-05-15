import { OpenAIChatTransport } from "./transport-openai.js";

export class NvidiaNimProvider extends OpenAIChatTransport {
  get id() {
    return "nvidia_nim";
  }
  get label() {
    return "NVIDIA NIM";
  }

  protected resolveModel(requestedModel: string): string {
    // If routing sent us "nvidia_nim/some-model", strip the prefix
    const parts = requestedModel.split("/");
    if (parts[0] === "nvidia_nim") return parts.slice(1).join("/");
    return requestedModel;
  }
}
