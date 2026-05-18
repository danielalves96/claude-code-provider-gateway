import { OpenAIChatTransport } from "./transport-openai.js";

export class OpenCodeGoProvider extends OpenAIChatTransport {
  get id() {
    return "opencode_go";
  }
  get label() {
    return "OpenCode Go";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "opencode_go") return parts.slice(1).join("/");
    return requestedModel;
  }
}
