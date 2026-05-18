import { OpenAIChatTransport } from "./transport-openai.js";

export class GLMCNProvider extends OpenAIChatTransport {
  get id() {
    return "glm_cn";
  }
  get label() {
    return "GLM (China)";
  }

  protected resolveModel(requestedModel: string): string {
    const parts = requestedModel.split("/");
    if (parts[0] === "glm_cn") return parts.slice(1).join("/");
    return requestedModel;
  }
}
